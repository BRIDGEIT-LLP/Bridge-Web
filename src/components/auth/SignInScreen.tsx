"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader } from "@/components/common/loader";
import { loginUser, loginWithOtp, selectMfaChannel, type Portal } from "@/services/auth.service";
import { setSession } from "@/lib/auth-session";
import { normalizeRole, type Role } from "@/lib/roles";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { EMAIL_REGEX, PHONE_REGEX } from "@/lib/validation";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

interface LoginForm {
  email: string;
  password: string;
  /** One-time-code mode: an email address or a mobile number. */
  identifier: string;
}

type SignInMode = "password" | "otp";

/**
 * Staff portals map to a fixed role — the backend may not echo `role` on the
 * admin/superadmin login step, but the route already tells us who's signing in.
 * The user portal has no fixed role (it depends on the account), so it relies on
 * the backend's `role` field.
 */
const PORTAL_ROLE: Partial<Record<Portal, Role>> = {
  admin: "admin",
  superadmin: "super_admin",
};

interface SignInScreenProps {
  /** Route prefix for this portal's flow, e.g. "/login" or "/admin/login". */
  basePath?: string;
  /** Which portal's backend endpoints to hit. */
  portal?: Portal;
  /** Badge / heading / subheading copy and whether to show the register link. */
  badge?: string;
  heading?: string;
  subheading?: string;
  showRegister?: boolean;
}

/**
 * Shared sign-in screen for every portal (user / admin / superadmin). Behaviour
 * is identical; props select the route prefix, backend endpoints, and copy.
 * Defaults serve the normal `/login` portal, so admin/superadmin pages only pass
 * what differs. On success it advances to the portal's MFA channel step; the
 * final landing route is decided by the backend at verify-otp.
 */
export function SignInScreen({
  basePath = "/login",
  portal = "user",
  badge = "Corporate Portal",
  heading = "Welcome",
  subheading = "Enter your credentials to access your secure portal.",
  showRegister = true,
}: SignInScreenProps) {
  const router = useRouter();
  const { data: onboardingDraft, setData, reset } = useOnboarding();
  const [showPassword, setShowPassword] = useState(false);
  // One-time-code sign-in exists on the user portal only (admin/superadmin stay password-based).
  const [mode, setMode] = useState<SignInMode>("password");
  const isOtpMode = portal === "user" && mode === "otp";

  const {
    register: field,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "", identifier: "" },
    // Only the fields of the visible mode are validated/submitted.
    shouldUnregister: true,
  });

  const switchMode = (next: SignInMode) => {
    setMode(next);
    clearErrors();
  };

  /** One-time-code sign-in: the backend sends the code, then we go straight to the code screen. */
  const onSubmitOtp = async (values: LoginForm) => {
    try {
      const identifier = values.identifier.trim();
      const res = await loginWithOtp({ identifier });
      const channel = res.data?.channel ?? (identifier.includes("@") ? "EMAIL" : "PHONE");
      const role = normalizeRole(res.data?.role);
      if (role) {
        setSession({ role, user: { email: identifier.includes("@") ? identifier : undefined } });
      }
      // A leftover draft belongs to whoever filled it in (see the password flow below).
      const draftEmail = String(onboardingDraft.email ?? "").trim().toLowerCase();
      if (identifier.includes("@") && draftEmail && draftEmail !== identifier.toLowerCase()) reset();
      // The verify screen shows the masked target of the chosen channel. For an unknown
      // account the backend returns only `maskedDestination` (the typed identifier, masked).
      setData({
        mfaChannel: channel,
        maskedEmail: res.data?.maskedEmail ?? (channel === "EMAIL" ? res.data?.maskedDestination ?? "" : ""),
        maskedMobile: res.data?.maskedMobile ?? (channel === "PHONE" ? res.data?.maskedDestination ?? "" : ""),
      });
      toast.success(res.message ?? "Verification code sent.");
      router.push(`${basePath}/verify-otp`);
    } catch (err) {
      const apiErr = err as ApiError;
      const isBlocked = Boolean((apiErr.data as { data?: { isEmailBlocked?: boolean } } | undefined)?.data?.isEmailBlocked);
      toast.error(apiErr.message ?? ERROR_MESSAGES.LOGIN_FAILED, isBlocked ? { duration: 15000 } : undefined);
    }
  };

  const onSubmit = async (values: LoginForm) => {
    if (isOtpMode) return onSubmitOtp(values);
    try {
      // The pre-MFA token is an httpOnly cookie now, set directly by the backend on
      // this response — nothing for the client to store. A non-2xx response (bad
      // credentials) already throws via the axios interceptor and lands in catch.
      const res = await loginUser({ email: values.email, password: values.password }, portal);
      if (!res.data) {
        throw { message: ERROR_MESSAGES.NO_SESSION } as ApiError;
      }
      // Persist the role so the dashboard can render the role-specific view once
      // MFA completes (we never decode the JWT). Prefer the backend's enum
      // (normalized to our Role); for staff portals fall back to the role implied
      // by the route so a missing `role` field doesn't bounce us off /dashboard.
      const role = normalizeRole(res.data.role) ?? PORTAL_ROLE[portal] ?? null;
      if (role) {
        // Show the real name in the dashboard when the backend returns it; the
        // sidebar falls back to the email when `name` is empty.
        const fullName = [res.data.first_name, res.data.last_name].filter(Boolean).join(" ").trim();
        setSession({ role, user: { email: values.email, name: fullName || undefined } });
      }
      // A leftover registration draft belongs to whoever filled it in. Signing in as someone else must not
      // inherit their answers (e.g. a different account's intent showing up as "selected").
      const draftEmail = String(onboardingDraft.email ?? "").trim().toLowerCase();
      if (draftEmail && draftEmail !== values.email.trim().toLowerCase()) reset();
      // Persist the masked contact info for the verification-channel screen. Both
      // values arrive already masked from the backend — no client-side masking.
      setData({
        maskedEmail: res.data.maskedEmail ?? "",
        maskedMobile: res.data.maskedMobile ?? "",
      });
      toast.success(res.message ?? SUCCESS_MESSAGES.LOGIN);

      if (portal === "user") {
        // No channel choice for members: after email + password the code goes to that
        // email. If sending fails (e.g. resend cooldown) fall back to the channel screen,
        // which lets them retry or pick mobile — the pre-MFA cookie is already set.
        try {
          const sent = await selectMfaChannel({ channel: "EMAIL" }, portal);
          setData({ mfaChannel: "EMAIL" });
          toast.success(sent.message ?? "Verification code sent.");
          router.push(`${basePath}/verify-otp`);
          return;
        } catch (sendErr) {
          const sendApiErr = sendErr as ApiError;
          toast.error(sendApiErr.message ?? "Couldn't send the code. Please try again.");
          // 429 = a code was already sent moments ago (e.g. signing in from another browser): it is still valid,
          // so go to the code screen instead of the old channel picker. Anything else keeps the user here.
          if (sendApiErr.status === 429) {
            setData({ mfaChannel: "EMAIL" });
            router.push(`${basePath}/verify-otp`);
          }
          return;
        }
      }
      router.push(`${basePath}/select-channel`);
    } catch (err) {
      const apiErr = err as ApiError;
      // Blocked email (KYC rejected too many times): keep the message on screen longer
      // than a normal error toast — the user cannot do anything else from here.
      const isBlocked = Boolean((apiErr.data as { data?: { isEmailBlocked?: boolean } } | undefined)?.data?.isEmailBlocked);
      toast.error(apiErr.message ?? ERROR_MESSAGES.LOGIN_FAILED, isBlocked ? { duration: 15000 } : undefined);
    }
  };

  // Shared input/label/error styling (FRD design system) — every portal's sign-in form
  // (member, admin, super admin) is one narrow centred card using these same tokens.
  const fieldCls = (hasError: boolean) =>
    `min-h-[42px] w-full rounded-lg border bg-white px-3 py-2.5 text-sm leading-[1.4] text-[#1A1F2B] transition-[border-color,box-shadow] placeholder:text-[#8A93A0] hover:border-[#B4BDC9] focus:border-[#0C56D0] focus:outline-none focus:ring-[3px] focus:ring-[#EAF1FC] ${
      hasError ? "border-[#9F403D]" : "border-[#CFD6DF]"
    }`;
  const labelCls = "text-[12.5px] font-semibold text-[#1A1F2B]";
  const msgCls = "text-xs text-[#9F403D]";

  // Member sign-in follows the design prototype: a single narrow centred card (no editorial
  // column). Admin / superadmin portals use the same card styling below, with staff-only copy.
  if (portal === "user") {
    return (
      <div className="min-h-full bg-[#F6F8FA] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-[470px] flex-col gap-[18px] rounded-[14px] border border-[#E3E8EE] bg-white p-[22px_18px] shadow-[0_10px_30px_rgba(26,31,43,.08)] sm:rounded-2xl sm:p-8">
          <div>
            <h2 className="font-headline text-[22px] font-bold tracking-[-0.01em] text-[#1A1F2B]">Welcome back</h2>
            <p className="mt-1 text-[13px] text-[#5B6472]">Sign in to see your introductions.</p>
          </div>

          <div role="tablist" aria-label="Sign-in method" className="inline-flex self-start overflow-hidden rounded-lg border border-[#CFD6DF] bg-white">
            {(["password", "otp"] as const).map((m, i) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`px-3.5 py-[7px] text-[12.5px] font-semibold ${i > 0 ? "border-l border-[#CFD6DF]" : ""} ${
                  mode === m ? "bg-[#EAF1FC] text-[#0C56D0]" : "text-[#5B6472]"
                }`}
              >
                {m === "password" ? "Password" : "One-time code"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
            {isOtpMode ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="identifier" className={labelCls}>Mobile number or email</label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="name@company.com"
                  className={fieldCls(Boolean(errors.identifier))}
                  {...field("identifier", {
                    required: "Enter your email or mobile number",
                    validate: (v) =>
                      EMAIL_REGEX.test(v.trim()) ||
                      PHONE_REGEX.test(v.trim()) ||
                      "Enter a valid 10 digit mobile number or an email like name@company.com",
                  })}
                />
                {errors.identifier && <p className={msgCls}>{errors.identifier.message}</p>}
              </div>
            ) : (
              <>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="email" className={labelCls}>Work email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="name@company.com"
                    className={fieldCls(Boolean(errors.email))}
                    {...field("email", {
                      required: "Enter your email",
                      pattern: { value: EMAIL_REGEX, message: "Enter an email like name@company.com" },
                    })}
                  />
                  {errors.email && <p className={msgCls}>{errors.email.message}</p>}
                </div>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor="password" className={labelCls}>Password</label>
                    <Link
                      href={`/reset-password?from=${encodeURIComponent(basePath)}`}
                      className="text-[12.5px] font-semibold text-[#0C56D0] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your password"
                      className={`${fieldCls(Boolean(errors.password))} !pr-14`}
                      {...field("password", { required: "Enter your password" })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1.5 text-xs font-semibold text-[#5B6472]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {errors.password && <p className={msgCls}>{errors.password.message}</p>}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#0C56D0] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0A49B0] active:bg-[#083C92] disabled:cursor-not-allowed disabled:bg-[#A8BFE8]"
            >
              {isSubmitting ? <Loader size={18} /> : isOtpMode ? "Send code" : "Sign in"}
            </button>

            <p className="pt-1 text-center text-[13px] text-[#5B6472]">
              Not a member yet?{" "}
              <Link href="/registration" className="font-semibold text-[#0C56D0] hover:underline">
                Apply for membership
              </Link>
            </p>
          </form>
        </div>

        {/* Not part of the prototype, but staff still need a way in. */}
        <p className="mt-4 text-center text-xs text-[#8A93A0]">
          <Link href="/admin/login" className="font-semibold hover:text-[#0C56D0] hover:underline">
            Administrator login
          </Link>
        </p>
      </div>
    );
  }

  // Admin / super admin: same single centred card as the member sign-in (FRD design
  // system), with staff-appropriate copy — no OTP tab (staff stay password-based) and
  // no "Apply for membership" link.
  return (
    <div className="flex min-h-full items-center justify-center bg-[#F6F8FA] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[470px] flex-col gap-[18px] rounded-[14px] border border-[#E3E8EE] bg-white p-[22px_18px] shadow-[0_10px_30px_rgba(26,31,43,.08)] sm:rounded-2xl sm:p-8">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center rounded-full bg-[#EAF1FC] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0C56D0]">
            {badge}
          </span>
          <div>
            <h2 className="font-headline text-[22px] font-bold tracking-[-0.01em] text-[#1A1F2B]">{heading}</h2>
            <p className="mt-1 text-[13px] text-[#5B6472]">{subheading}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="email" className={labelCls}>Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="name@company.com"
              className={fieldCls(Boolean(errors.email))}
              {...field("email", {
                required: "Enter your email",
                pattern: { value: EMAIL_REGEX, message: "Enter an email like name@company.com" },
              })}
            />
            {errors.email && <p className={msgCls}>{errors.email.message}</p>}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="password" className={labelCls}>Password</label>
              <Link
                href={`/reset-password?from=${encodeURIComponent(basePath)}`}
                className="text-[12.5px] font-semibold text-[#0C56D0] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                className={`${fieldCls(Boolean(errors.password))} !pr-14`}
                {...field("password", { required: "Enter your password" })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1.5 text-xs font-semibold text-[#5B6472]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && <p className={msgCls}>{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#0C56D0] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0A49B0] active:bg-[#083C92] disabled:cursor-not-allowed disabled:bg-[#A8BFE8]"
          >
            {isSubmitting ? <Loader size={18} /> : "Sign in"}
          </button>

          {showRegister && (
            <p className="pt-1 text-center text-[13px] text-[#5B6472]">
              Don&apos;t have an account yet?{" "}
              <Link href="/registration" className="font-semibold text-[#0C56D0] hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
