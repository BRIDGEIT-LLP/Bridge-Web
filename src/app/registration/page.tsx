"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm, useWatch, Controller } from "react-hook-form";
import { Icon } from "@/components/ui/Icon";
import { Loader } from "@/components/common/loader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/Select";
import { DIAL_CODES } from "@/lib/countries";
import { StepProgress } from "@/components/onboarding/StepProgress";
import { TermsModal } from "@/components/onboarding/TermsModal";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import {
  PASSWORD_RULES,
  PasswordRequirements,
  PasswordStrengthMeter,
  metRuleCount,
} from "@/components/auth/PasswordStrength";
import { toast } from "sonner";
import { registerCompany, verifyGst, verifyCin } from "@/services/auth.service";
import { clearSession } from "@/lib/auth-session";
import { GST_REGEX, CIN_REGEX, PASSWORD_REGEX, EMAIL_REGEX, phoneErrorForDialCode, nationalDigits } from "@/lib/validation";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

/** Live GST/CIN-check status, driven by each field's onBlur — purely for the adornment icon. */
type FieldCheckStatus = "idle" | "checking" | "verified";

const ROLES = [
  { value: "startup", label: "Startup" },
  { value: "investor", label: "Investor" },
  { value: "b2b_enterprise", label: "B2B Enterprise" },
];

// Maps the UI role values to the backend's expected enum.
const ROLE_MAP: Record<string, "INVESTOR" | "B2B" | "STARTUP"> = {
  startup: "STARTUP",
  investor: "INVESTOR",
  b2b_enterprise: "B2B",
};

const LABEL = "text-xs font-bold text-on-surface-variant tracking-wide px-1 font-label";

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="px-1 text-xs font-medium text-error">{msg}</span>;
}

interface RegisterForm {
  legalName: string;
  email: string;
  password: string;
  confirmPassword: string;
  countryCode: string;
  contact: string;
  role: string;
  gstNumber: string;
  cinNumber: string;
  termsAccepted: boolean;
}

export default function RegisterPage() {
  const { setData, goNext, reset } = useOnboarding();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Landing on registration starts a fresh signup: wipe the onboarding blob, the
  // auth tokens, and any stored session so no stale auth/role carries over.
  useEffect(() => {
    reset();
    clearSession();
  }, [reset]);
  const [termsOpen, setTermsOpen] = useState(false);

  // Defaults are hardcoded empty, not sourced from `data`: this page always starts a
  // fresh signup (see the reset() effect above), and by the time that reset actually
  // clears `data`, react-hook-form would have already locked in whatever stale values
  // were there at mount — reading from `data` here would just race that reset.
  const {
    register: field,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    clearErrors,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    defaultValues: {
      legalName: "",
      email: "",
      password: "",
      confirmPassword: "",
      countryCode: "+91",
      contact: "",
      role: "",
      gstNumber: "",
      cinNumber: "",
      termsAccepted: false,
    },
  });

  const passwordVal = watch("password");

  // The strength meter + requirements card only exist while the user is actually
  // working on the password: focused, or left with a value that doesn't pass yet.
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordComplete = metRuleCount(passwordVal) === PASSWORD_RULES.length;
  const showPasswordHelp = passwordFocused || (passwordVal.length > 0 && !passwordComplete);

  // Registered separately so the focus handlers below can wrap RHF's own onBlur.
  const passwordField = field("password", {
    required: "Password is required.",
    pattern: {
      value: PASSWORD_REGEX,
      message: "Min 8 chars with uppercase, lowercase, number and symbol.",
    },
  });

  const role = useWatch({ control, name: "role" });
  const isB2B = role === "b2b_enterprise";

  const gstNumberVal = useWatch({ control, name: "gstNumber" });
  const [gstStatus, setGstStatus] = useState<FieldCheckStatus>("idle");
  // The exact value (uppercased) that last came back verified — editing after that
  // invalidates the checkmark until the field is re-checked on the next blur.
  const verifiedGstRef = useRef<string | null>(null);
  // Guards against out-of-order responses: blur, edit, blur again before the first
  // call resolves — only the response matching the latest request may apply state.
  const gstRequestIdRef = useRef(0);
  useEffect(() => {
    if (verifiedGstRef.current && verifiedGstRef.current !== gstNumberVal?.toUpperCase()) {
      setGstStatus("idle");
    }
  }, [gstNumberVal]);

  // Registered separately so onBlur can trigger the sandbox.co.in check below. The
  // `validate` rule is the actual submit-time gate — RHF re-runs it on submit, so
  // baking gstStatus into it (not just format) means a failed/never-attempted check
  // blocks submission even if setError's manual error got wiped by that re-validation,
  // or the field was never blurred at all (paste + Enter, autofill). Rules are also
  // gated on isB2B — see the block-level comment above isB2B for why.
  const gstField = field("gstNumber", {
    required: isB2B ? "GST number is required." : false,
    validate: (v) => {
      if (!isB2B) return true;
      if (!GST_REGEX.test(v.toUpperCase())) return "Enter a valid 15-character GSTIN.";
      return gstStatus === "verified" || "Please verify your GST number before continuing.";
    },
  });

  const handleGstBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    gstField.onBlur(e);
    const value = e.target.value.trim().toUpperCase();
    // Normalize the field's actual RHF value to match what gets verified/refed below —
    // otherwise a lowercase/padded input can show "✓ Verified" while onSubmit still
    // posts the original, differently-cased string.
    setValue("gstNumber", value, { shouldValidate: false });
    // Let the format `validate` rule above show its own error for empty/malformed input.
    if (!value || !GST_REGEX.test(value)) return;

    const requestId = ++gstRequestIdRef.current;
    setGstStatus("checking");
    try {
      const res = await verifyGst({ gstin: value });
      if (requestId !== gstRequestIdRef.current) return; // superseded by a newer blur

      // A 2xx response doesn't guarantee verification — check the flag explicitly.
      if (!res.data?.verified) {
        throw { message: res.message ?? ERROR_MESSAGES.GST_VERIFICATION_FAILED } as ApiError;
      }
      clearErrors("gstNumber");
      verifiedGstRef.current = value;
      setGstStatus("verified");
      toast.success(res.message ?? SUCCESS_MESSAGES.GST_VERIFIED);
    } catch (err) {
      if (requestId !== gstRequestIdRef.current) return; // superseded by a newer blur

      setGstStatus("idle");
      const message = (err as ApiError).message ?? ERROR_MESSAGES.GST_VERIFICATION_FAILED;
      setError("gstNumber", { type: "manual", message });
      toast.error(message);
    }
  };

  const cinNumberVal = useWatch({ control, name: "cinNumber" });
  const [cinStatus, setCinStatus] = useState<FieldCheckStatus>("idle");
  const verifiedCinRef = useRef<string | null>(null);
  const cinRequestIdRef = useRef(0);
  useEffect(() => {
    if (verifiedCinRef.current && verifiedCinRef.current !== cinNumberVal?.toUpperCase()) {
      setCinStatus("idle");
    }
  }, [cinNumberVal]);

  // Registered separately so onBlur can trigger the CIN check below. Mirrors the GST
  // block above, including gating the rules on isB2B and baking cinStatus into `validate`
  // for the same reasons.
  const cinField = field("cinNumber", {
    required: isB2B ? "CIN number is required." : false,
    validate: (v) => {
      if (!isB2B) return true;
      if (!CIN_REGEX.test(v.toUpperCase())) return "Enter a valid 21-character CIN.";
      return cinStatus === "verified" || "Please verify your CIN number before continuing.";
    },
  });

  const handleCinBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    cinField.onBlur(e);
    const value = e.target.value.trim().toUpperCase();
    // Normalize the field's actual RHF value — see the matching comment in handleGstBlur.
    setValue("cinNumber", value, { shouldValidate: false });
    if (!value || !CIN_REGEX.test(value)) return;

    const requestId = ++cinRequestIdRef.current;
    setCinStatus("checking");
    try {
      const res = await verifyCin({ cin: value });
      if (requestId !== cinRequestIdRef.current) return; // superseded by a newer blur

      // A 2xx response doesn't guarantee verification — check the flag explicitly.
      if (!res.data?.verified) {
        throw { message: res.message ?? ERROR_MESSAGES.CIN_VERIFICATION_FAILED } as ApiError;
      }
      clearErrors("cinNumber");
      verifiedCinRef.current = value;
      setCinStatus("verified");
      toast.success(res.message ?? SUCCESS_MESSAGES.CIN_VERIFIED);
    } catch (err) {
      if (requestId !== cinRequestIdRef.current) return; // superseded by a newer blur

      setCinStatus("idle");
      const message = (err as ApiError).message ?? ERROR_MESSAGES.CIN_VERIFICATION_FAILED;
      setError("cinNumber", { type: "manual", message });
      toast.error(message);
    }
  };

  const onSubmit = async (values: RegisterForm) => {
    // Payload shaped to the backend schema (field names, role enum, password, terms).
    const payload = {
      companyName: values.legalName,
      email: values.email,
      countryCode: values.countryCode,
      phoneNumber: nationalDigits(values.contact),
      password: values.password,
      role: ROLE_MAP[values.role],
      termsAccepted: true,
      gstNumber: isB2B ? values.gstNumber : undefined,
      cinNumber: isB2B ? values.cinNumber : undefined,
    };

    try {
      // Tokens are issued here as httpOnly cookies directly on this response — no
      // client-side storage step needed; the axios interceptor already throws on
      // a non-2xx (failed) response.
      const res = await registerCompany(payload);
      toast.success(res.message ?? SUCCESS_MESSAGES.REGISTRATION);
      // Persist UI-shaped fields so prefill keeps working on back-navigation.
      setData({
        legalName: values.legalName,
        email: values.email,
        countryCode: values.countryCode,
        contact: nationalDigits(values.contact),
        role: values.role,
        gstNumber: values.gstNumber,
        cinNumber: values.cinNumber,
      });
      goNext("details");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Registration failed. Please try again.");
    }
  };

  return (
    <main className="mx-auto grid max-w-[1200px] min-h-[calc(100vh-80px)] grid-cols-1 items-center gap-10 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:py-8">
      {/* Left: editorial context */}
      <div className="flex flex-col gap-6 lg:col-span-5 lg:gap-8">
        <div className="space-y-4">
          <span className="inline-flex rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold uppercase tracking-wider text-on-secondary-container">
            Onboarding
          </span>
          <h1 className="font-headline text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-on-surface sm:text-4xl lg:text-5xl">
            Unlock Your <br />
            <span className="text-primary">Enterprise</span> Future.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-on-surface-variant sm:text-lg">
            Join over 5,000 corporate partners streamlining their digital operations with our
            precision-engineered toolset.
          </p>
        </div>
        <div className="flex flex-col gap-6 rounded-2xl bg-surface-container p-6 sm:p-8">
          {[
            { icon: "verified_user", title: "Secure Infrastructure", body: "Military-grade encryption for all financial data." },
            { icon: "rocket_launch", title: "Instant Approval", body: "Automated GST verification for faster access." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-surface-container-highest text-primary">
                <Icon name={f.icon} size={22} />
              </div>
              <div>
                <p className="font-bold text-on-surface">{f.title}</p>
                <p className="text-sm text-on-surface-variant">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: form card */}
      <div className="lg:col-span-7">
        <Card padding="lg" className="flex flex-col gap-3 !p-5 sm:!p-6 lg:gap-3 lg:!p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-headline text-2xl font-bold text-on-surface">Company Registration</h2>
          </div>
          {/* <StepProgress stepKey="details" /> */}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              id="legalName"
              type="text"
              label="Legal Company Name"
              required
              placeholder="Global Tech Corp"
              error={errors.legalName?.message}
              adornment={<Icon name="corporate_fare" size={20} />}
              adornmentClassName="text-primary opacity-0 transition-opacity group-focus-within:opacity-100"
              {...field("legalName", {
                required: "Company name is required.",
                minLength: { value: 3, message: "Company name must be at least 3 characters." },
              })}
            />

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
              <label className={LABEL}>
                Contact Number<span className="align-middle text-base leading-none text-error"> *</span>
              </label>
              {/* An <input> has an intrinsic default width, so the `min-w-0` on the tel field
                  below is load-bearing: without it the flex item refuses to shrink, widening
                  this row past the card and pushing the trailing icon off-screen on a phone. */}
              <div className={`relative flex h-10 w-full min-w-0 items-center rounded-lg border bg-surface-container-low transition-all duration-200 focus-within:border-primary focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/10 ${errors.contact?.message ? "border-error/80 ring-2 ring-error/10" : "border-outline-variant/30"
                }`}>
                <div className="w-[4.4rem] shrink-0 sm:w-[4.8rem]">
                  <Controller
                    control={control}
                    name="countryCode"
                    render={({ field: cc }) => (
                      <Select
                        aria-label="Country code"
                        searchable
                        placeholder="Code"
                        options={DIAL_CODES}
                        value={cc.value}
                        onChange={(v) => {
                          cc.onChange(v);
                          void trigger("contact");
                        }}
                        className="flex h-10 w-full items-center justify-between gap-1 bg-transparent px-2.5 text-left text-sm text-on-surface outline-none cursor-pointer hover:opacity-85 sm:px-3"   
                        panelClassName="w-64 max-w-[calc(100vw-2.5rem)] sm:w-80"
                        displayValueOnly
                      />
                    )}
                  />
                </div>
                <div className="h-5 w-px bg-outline-variant/30 shrink-0" />
                 <input
                  id="contact"
                  type="tel"
                  placeholder="9632585698"
                  className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-on-surface outline-none placeholder:text-outline-variant sm:px-3"
                  {...field("contact", {
                    required: "Contact number is required.",
                    validate: (v, values) =>
                      !v?.trim() ? true : (phoneErrorForDialCode(values.countryCode, v, false) ?? true),
                  })}
                />
                <div className="flex shrink-0 items-center pr-2.5 text-on-surface-variant sm:pr-3">
                  <Icon name="smartphone" size={18} />
                </div>
              </div>
              {errors.contact?.message && (
                <span className="px-1 text-xs font-medium text-error">{errors.contact.message}</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                label="Account Password"
                required
                placeholder="••••••••••••"
                error={errors.password?.message}
                adornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex items-center justify-center text-on-surface-variant transition-colors hover:text-primary h-full"
                  >
                    <Icon name={showPassword ? "visibility_off" : "visibility"} size={20} />
                  </button>
                }
                {...passwordField}
                onFocus={() => setPasswordFocused(true)}
                onBlur={(e) => {
                  passwordField.onBlur(e);
                  setPasswordFocused(false);
                }}
              />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm Password"
                required
                placeholder="••••••••••••"
                error={errors.confirmPassword?.message}
                adornment={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="flex items-center justify-center text-on-surface-variant transition-colors hover:text-primary h-full"
                  >
                    <Icon name={showConfirmPassword ? "visibility_off" : "visibility"} size={20} />
                  </button>
                }
                {...field("confirmPassword", {
                  required: "Please confirm your password.",
                  validate: (val) => val === passwordVal || "Passwords do not match.",
                })}
              />
            </div>

            {showPasswordHelp && (
              <>
                <PasswordStrengthMeter value={passwordVal} />
                <PasswordRequirements value={passwordVal} />
              </>
            )}

            <div className="flex flex-col gap-2">
              <label className={LABEL}>
                Select Your Role<span className="align-middle text-base leading-none text-error"> *</span>
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="flex h-10 cursor-pointer items-center gap-2.5 px-1 transition-all hover:opacity-85"
                  >
                    <input
                      type="radio"
                      value={r.value}
                      className="size-4 cursor-pointer accent-primary border-outline-variant text-primary focus:ring-primary/20"
                      {...field("role", { required: "Please select a role." })}
                    />
                    <span className="text-sm font-medium text-on-surface cursor-pointer select-none">{r.label}</span>
                  </label>
                ))}
              </div>
              <ErrorText msg={errors.role?.message} />
            </div>

            {/* B2B-only: GST + CIN, revealed after role selection */}
            {isB2B && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  id="gstNumber"
                  type="text"
                  label="GST Number"
                  required
                  placeholder="22AAAAA0000A1Z5"
                  error={errors.gstNumber?.message}
                  adornment={
                    gstStatus === "checking" ? (
                      <Loader size={16} />
                    ) : gstStatus === "verified" ? (
                      <Icon name="check_circle" size={20} />
                    ) : (
                      <Icon name="pin" size={20} />
                    )
                  }
                  adornmentClassName={gstStatus === "verified" ? "text-primary" : undefined}
                  {...gstField}
                  onBlur={handleGstBlur}
                />
                <Input
                  id="cinNumber"
                  type="text"
                  label="CIN Number"
                  required
                  placeholder="U12345MH2024PTC123456"
                  error={errors.cinNumber?.message}
                  adornment={
                    cinStatus === "checking" ? (
                      <Loader size={16} />
                    ) : cinStatus === "verified" ? (
                      <Icon name="check_circle" size={20} />
                    ) : (
                      <Icon name="pin" size={20} />
                    )
                  }
                  adornmentClassName={cinStatus === "verified" ? "text-primary" : undefined}
                  {...cinField}
                  onBlur={handleCinBlur}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3 px-1">
                <Controller
                  control={control}
                  name="termsAccepted"
                  rules={{ required: "Please accept the Terms of Service and Privacy Policy." }}
                  render={({ field: termsField }) => (
                    <input
                      type="checkbox"
                      readOnly
                      checked={!!termsField.value}
                      onClick={(e) => {
                        e.preventDefault();
                        setTermsOpen(true);
                      }}
                      className="mt-1 size-4 cursor-pointer rounded accent-primary border-outline-variant text-primary focus:ring-primary/20"
                    />
                  )}
                />
                <span className="text-sm leading-tight text-on-surface-variant">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="font-bold text-primary hover:underline"
                  >
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="font-bold text-primary hover:underline"
                  >
                    Privacy Policy
                  </button>{" "}
                  regarding corporate data handling.<span className="align-middle text-base leading-none text-error"> *</span>
                </span>
              </div>
              <ErrorText msg={errors.termsAccepted?.message} />
            </div>

            <TermsModal
              open={termsOpen}
              onClose={() => setTermsOpen(false)}
              onAgree={() => {
                setValue("termsAccepted", true, { shouldValidate: true });
                setTermsOpen(false);
              }}
            />

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isSubmitting || gstStatus === "checking" || cinStatus === "checking"}
                className="cta-gradient flex h-12 w-full items-center justify-center gap-2 bg-primary rounded-xl font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <Loader size={18} /> : "Continue"}
              </button>
              <p className="text-center text-sm text-on-surface-variant">
                Already registered? <Link href="/login" className="font-bold text-primary hover:underline">Sign in to portal</Link>
              </p>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
