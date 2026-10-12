"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Loader } from "@/components/common/loader";
import { Input } from "@/components/ui/input";
import { loginUser, type Portal } from "@/services/auth.service";
import { setSession } from "@/lib/auth-session";
import { normalizeRole, type Role } from "@/lib/roles";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { EMAIL_REGEX } from "@/lib/validation";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

/** "Built for every stage" — who BRIDGE serves. */
const STAGES = [
  {
    icon: "rocket_launch",
    title: "Startups & Founders",
    body: "Pitch your vision to pre-vetted investors. Share traction, funding ask, and team details — get matched with angels, VCs, and PE firms aligned to your stage.",
  },
  {
    icon: "trending_up",
    title: "Investors & Funds",
    body: "Discover high-potential startups filtered by sector, stage, and ticket size. Review founder profiles, traction metrics, and connect through private deal rooms.",
  },
  {
    icon: "handshake",
    title: "B2B Partnerships",
    body: "Find manufacturers, distributors, exporters, and buyers across 20+ industries. Match by intent, geography, and revenue band to build your supply chain.",
  },
];

/** "How it works" — the four-step flow. */
const STEPS = [
  {
    title: "Choose Your Path",
    body: "Sign up and select your mode — B2B partnerships, Founder seeking investors, or Investor discovering startups.",
  },
  {
    title: "Get Matched Intelligently",
    body: "Our algorithm pairs founders with investors by sector and stage, and matches B2B partners by intent and geography.",
  },
  {
    title: "Connect with Confidence",
    body: "Every profile is verified. Send connection requests, accept pitches, and start conversations — no spam, no noise.",
  },
  {
    title: "Close in Deal Rooms",
    body: "Private deal rooms for negotiations, document sharing, AI-powered suggestions, and scheduling calls.",
  },
];

/** "Why BRIDGE" — quick proof points. */
const WHY = [
  "Verification-first — every profile is vetted before you see it",
  "Three modes tailored to B2B, Founders, and Investors",
  "AI compatibility scoring and smart recommendations",
  "Pan-India network spanning 20+ industries and 35+ countries",
];

/** Small uppercase section heading used down the editorial column. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-xs font-bold uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}

interface LoginForm {
  email: string;
  password: string;
}

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
  const { setData } = useOnboarding();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
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
      // Persist the masked contact info for the verification-channel screen. Both
      // values arrive already masked from the backend — no client-side masking.
      setData({
        maskedEmail: res.data.maskedEmail ?? "",
        maskedMobile: res.data.maskedMobile ?? "",
      });
      toast.success(res.message ?? SUCCESS_MESSAGES.LOGIN);
      router.push(`${basePath}/select-channel`);
    } catch (err) {
      toast.error((err as ApiError).message ?? ERROR_MESSAGES.LOGIN_FAILED);
    }
  };

  return (
    <main className="no-scrollbar mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 py-6 sm:px-6 lg:h-[calc(100vh-80px)] lg:grid-cols-12 lg:gap-12 lg:overflow-y-auto lg:py-0">
      {/* Left: editorial context — scrolls with the page; the card stays pinned. */}
      <div className="flex flex-col gap-8 lg:col-span-7 lg:py-10">
        <div className="space-y-4">
          {/* <span className="inline-flex rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold uppercase tracking-wider text-on-secondary-container">
            {badge}
          </span> */}
          <h1 className="font-headline text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-on-surface sm:text-4xl lg:text-[2.75rem]">
            Where businesses, startups &amp; <span className="text-primary">investors connect</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
            Whether you&apos;re scaling a startup, sourcing investment, or growing your supply
            chain - BRIDGE matches you with verified partners who fit.
          </p>
        </div>

        {/* Built for every stage */}
        <div className="flex flex-col gap-5">
          <SectionLabel>Built for every stage</SectionLabel>
          <div className="flex flex-col gap-5">
            {STAGES.map((s) => (
              <div key={s.title} className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-primary">
                  <Icon name={s.icon} size={22} />
                </div>
                <div>
                  <p className="font-bold text-on-surface">{s.title}</p>
                  <p className="text-sm leading-relaxed text-on-surface-variant">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="flex flex-col gap-5 rounded-2xl bg-surface-container p-6 sm:p-8">
          <SectionLabel>How it works</SectionLabel>
          <div className="flex flex-col gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex items-start gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-headline text-sm font-bold text-on-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="font-bold text-on-surface">{s.title}</p>
                  <p className="text-sm leading-relaxed text-on-surface-variant">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why BRIDGE */}
        <div className="flex flex-col gap-4">
          <SectionLabel>Why BRIDGE</SectionLabel>
          <ul className="flex flex-col gap-3">
            {WHY.map((w) => (
              <li key={w} className="flex items-start gap-3">
                <Icon name="check_circle" size={20} className="shrink-0 text-primary" />
                <span className="text-sm leading-relaxed text-on-surface-variant">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: form card — pinned (sticky) so only the text scrolls past it. */}
      <div className="lg:sticky lg:top-0 lg:col-span-5 lg:flex lg:h-[calc(100vh-80px)] lg:items-center lg:justify-center lg:self-start">
        <Card padding="lg" className="mx-auto flex w-full max-w-md flex-col gap-4 !p-5 sm:!p-6 lg:!p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-headline text-2xl font-bold text-on-surface">{heading}</h2>
            <p className="text-sm text-on-surface-variant">{subheading}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              id="email"
              type="email"
              label="Official Email Address"
              required
              placeholder="john@example.com"
              error={errors.email?.message}
              adornment={<Icon name="mail" size={20} />}
              {...field("email", {
                required: "Email is required.",
                pattern: { value: EMAIL_REGEX, message: "Enter a valid email address." },
              })}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <label
                  htmlFor="password"
                  className="font-label text-xs font-bold tracking-wide text-on-surface-variant"
                >
                  Password
                  <span className="align-middle text-base leading-none text-error"> *</span>
                </label>
                <Link
                  href={`/reset-password?from=${encodeURIComponent(basePath)}`}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                error={errors.password?.message}
                adornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex h-full items-center justify-center text-on-surface-variant transition-colors hover:text-primary"
                  >
                    <Icon name={showPassword ? "visibility_off" : "visibility"} size={20} />
                  </button>
                }
                {...field("password", { required: "Password is required." })}
              />
            </div>


            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="cta-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {isSubmitting ? <Loader size={18} /> : "Sign In"}
              </button>
              {showRegister && (
                <p className="text-center text-sm text-on-surface-variant">
                  Don't have an account yet?{" "}
                  <Link 
                    href="/registration" 
                    className="font-bold text-primary border-b border-transparent hover:border-current transition-colors"
                  >
                    Create an account
                  </Link>
                </p>
              )}
              {portal === "user" && (
                <p className="text-center text-sm text-on-surface-variant">
                  <Link 
                    href="/admin/login" 
                    className="font-bold text-primary border-b border-transparent hover:border-current transition-colors"
                  >
                    Administrator Login
                  </Link>
                </p>
              )}
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
