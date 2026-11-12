"use client";

import React, { Suspense, useEffect, useState } from "react";
import { BrandLockup } from "@/components/layout/navbar";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PasswordStrengthMeter, REGISTRATION_PASSWORD_RULES } from "@/components/auth/PasswordStrength";
import { useForm, useWatch, Controller } from "react-hook-form";
import { Lock, ShieldCheck, Users } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { DIAL_CODES } from "@/lib/countries";
import { ONBOARDING_STEPS } from "@/lib/onboarding-steps";
import { TermsModal } from "@/components/onboarding/TermsModal";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { toast } from "sonner";
import "./registration.css";
import { registerCompany } from "@/services/auth.service";
import { clearSession } from "@/lib/auth-session";
import { MEMBER_PASSWORD_REGEX, MEMBER_PASSWORD_MESSAGE, EMAIL_REGEX, phoneErrorForDialCode, nationalDigits } from "@/lib/validation";
import { SUCCESS_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

const ROLES = [
  { value: "b2b_enterprise", label: "Business owner", description: "Find verified partners" },
  { value: "startup", label: "Founder", description: "Meet the right investors" },
  { value: "investor", label: "Investor", description: "See vetted deal flow" },
];

// Maps the UI role values to the backend's expected enum.
const ROLE_MAP: Record<string, "INVESTOR" | "B2B" | "STARTUP"> = {
  startup: "STARTUP",
  investor: "INVESTOR",
  b2b_enterprise: "B2B",
};

interface RegisterForm {
  firstName: string;
  lastName: string;
  legalName: string;
  email: string;
  password: string;
  confirmPassword: string;
  countryCode: string;
  contact: string;
  role: string;
  /** Optional member name / invite code. Collected for the UI only; the register API has no field for it yet. */
  vouch: string;
  termsAccepted: boolean;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const { data, setData, goNext, reset, isDataLoaded } = useOnboarding();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // "?edit=1" means the account already exists and the user came back here (Back from the verify step, or Edit
  // on the Review screen): keep the draft and the session and show the saved details instead of starting over.
  const isEdit = useSearchParams().get("edit") === "1";
  // Landing on registration WITHOUT edit starts a fresh signup: wipe the onboarding blob, the
  // auth tokens, and any stored session so no stale auth/role carries over.
  useEffect(() => {
    if (isEdit) return;
    reset();
    clearSession();
  }, [reset, isEdit]);
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
    trigger,
    reset: resetForm,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterForm>({
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      legalName: "",
      email: "",
      password: "",
      confirmPassword: "",
      countryCode: "+91",
      contact: "",
      role: "startup",
      vouch: "",
      termsAccepted: false,
    },
  });

  // Edit mode: prefill the saved account details once the draft has loaded. The identity fields stay locked
  // (the account and its verified contact details already exist); only the name can still be corrected.
  useEffect(() => {
    if (!isEdit || !isDataLoaded) return;
    resetForm({
      firstName: String(data.firstName ?? ""),
      lastName: String(data.lastName ?? ""),
      legalName: String(data.legalName ?? ""),
      email: String(data.email ?? ""),
      password: "",
      confirmPassword: "",
      countryCode: String(data.countryCode ?? "") || "+91",
      contact: String(data.contact ?? ""),
      role: String(data.role ?? "") || "startup",
      vouch: String(data.vouch ?? ""),
      termsAccepted: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, isDataLoaded]);

  const passwordVal = watch("password");

  const passwordField = field("password", {
    required: isEdit ? false : "Create a password",
    validate: (v) => isEdit || MEMBER_PASSWORD_REGEX.test(v) || MEMBER_PASSWORD_MESSAGE,
    // Keep "Confirm password" in step when the password is changed afterwards.
    onChange: () => {
      if (getValues("confirmPassword")) void trigger("confirmPassword");
    },
  });

  const role = useWatch({ control, name: "role" });

  const onSubmit = async (values: RegisterForm) => {
    if (isEdit) {
      // Account already created: just keep the (possibly corrected) name and move on.
      setData({ firstName: values.firstName, lastName: values.lastName, vouch: values.vouch });
      goNext("details");
      return;
    }
    // Payload shaped to the backend schema (field names, role enum, password, terms).
    const payload = {
      company_name: values.legalName,
      company_email: values.email,
      country_code: values.countryCode,
      mobile_number: nationalDigits(values.contact),
      password: values.password,
      role: ROLE_MAP[values.role],
      termsAccepted: true,
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
    };

    try {
      // Tokens are issued here as httpOnly cookies directly on this response — no
      // client-side storage step needed; the axios interceptor already throws on
      // a non-2xx (failed) response.
      const res = await registerCompany(payload);
      toast.success(res.message ?? SUCCESS_MESSAGES.REGISTRATION);
      // Persist UI-shaped fields so prefill keeps working on back-navigation.
      setData({
        // First/last name are collected here in the new UI; the profile screen prefills from them.
        firstName: values.firstName,
        lastName: values.lastName,
        legalName: values.legalName,
        email: values.email,
        countryCode: values.countryCode,
        contact: nationalDigits(values.contact),
        role: values.role,
      });
      goNext("details");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Registration failed. Please try again.");
    }
  };

  const values = watch();
  const missing: string[] = [];
  if (!values.firstName?.trim()) missing.push("first name");
  if (!values.lastName?.trim()) missing.push("last name");
  if ((values.legalName?.trim().length ?? 0) < 2) missing.push("company name");
  if (!EMAIL_REGEX.test(values.email ?? "")) missing.push("email");
  if (!values.contact?.trim() || phoneErrorForDialCode(values.countryCode, values.contact, false)) missing.push("mobile number");
  if (!isEdit && !MEMBER_PASSWORD_REGEX.test(values.password ?? "")) missing.push("password");
  if (!isEdit && (!values.confirmPassword || values.confirmPassword !== values.password)) missing.push("matching password");
  if (!values.termsAccepted) missing.push("accepted terms");

  const missingText = missing.length
    ? `Still needed: ${missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}` : missing[0]}.`
    : "";

  const contactField = field("contact", {
    required: "Enter your mobile number",
    validate: (v, vals) => (!v?.trim() ? true : (phoneErrorForDialCode(vals.countryCode, v, false) ?? true)),
  });

  return (
    <div className="bp">
      <div className="ob">
        <div className="ob-top">
          <div className="brand" aria-label="Bridge Platform">
            <BrandLockup />
          </div>
        </div>

        <ol
          className="ob-progress"
          style={{ gridTemplateColumns: `repeat(${ONBOARDING_STEPS.length}, 1fr)` }}
          aria-label="Application progress"
        >
          {ONBOARDING_STEPS.map((s, i) => (
            <li key={s.key} className={i === 0 ? "current" : ""} aria-current={i === 0 ? "step" : undefined}>
              {i + 1} {s.label}
            </li>
          ))}
        </ol>

        <main className="ob-main">
          <div className="reg">
            <section className="pitch">
              <span className="eyebrow">Invite-only</span>
              <h1>The room where the right introduction happens.</h1>
              <p>
                Bridge is a verified, vouched network for Indian business owners, funded founders and investors. We make
                the introduction, and we tell you why.
              </p>
              <ul className="perks">
                <li>
                  <span className="perk-ic"><ShieldCheck size={16} /></span>
                  <div>
                    <strong>Everyone is verified</strong>
                    <span>GST, PAN and company filings checked for every member.</span>
                  </div>
                </li>
                <li>
                  <span className="perk-ic"><Users size={16} /></span>
                  <div>
                    <strong>Everyone is vouched for</strong>
                    <span>A founder or member puts their name on each person.</span>
                  </div>
                </li>
                <li>
                  <span className="perk-ic"><Lock size={16} /></span>
                  <div>
                    <strong>Private deal rooms</strong>
                    <span>Watermarked documents for due diligence.</span>
                  </div>
                </li>
              </ul>
            </section>

            <form className="ob-card" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div>
                <h2>{isEdit ? "Your application" : "Apply for membership"}</h2>
                <p className="lede">
                  {isEdit
                    ? "Your account is already created, so only your name can be changed here."
                    : "Takes about 8 minutes. You can save and finish later."}
                </p>
              </div>

              <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <legend className="lbl" style={{ marginBottom: 8 }}>I am applying as</legend>
                <div className="choice-grid">
                  {ROLES.map((r) => (
                    <label key={r.value} className="choice">
                      <input type="radio" value={r.value} disabled={isEdit} {...field("role", { required: isEdit ? false : "Please select a role." })} />
                      <strong>{r.label}</strong>
                      <span>{r.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="row">
                <FormField id="firstName" label="First name" error={errors.firstName?.message}>
                  <input
                    id="firstName"
                    type="text"
                    placeholder="Priya"
                    autoComplete="given-name"
                    aria-invalid={!!errors.firstName}
                    {...field("firstName", { required: "Enter your first name" })}
                  />
                </FormField>
                <FormField id="lastName" label="Last name" error={errors.lastName?.message}>
                  <input
                    id="lastName"
                    type="text"
                    placeholder="Raman"
                    autoComplete="family-name"
                    aria-invalid={!!errors.lastName}
                    {...field("lastName", { required: "Enter your last name" })}
                  />
                </FormField>
              </div>

              <FormField
                id="legalName"
                label={role === "investor" ? "Fund or company name" : "Legal company name"}
                error={errors.legalName?.message}
              >
                <input
                  id="legalName"
                  type="text"
                  placeholder={role === "investor" ? "Northbridge Ventures" : "Global Tech Corp"}
                  autoComplete="organization"
                  aria-invalid={!!errors.legalName}
                  readOnly={isEdit}
                  {...field("legalName", {
                    required: "Enter your company or fund name",
                    minLength: { value: 2, message: "Enter the full legal name" },
                  })}
                />
              </FormField>

              <FormField id="email" label="Work email" error={errors.email?.message}>
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  readOnly={isEdit}
                  {...field("email", {
                    required: "Enter your work email",
                    pattern: { value: EMAIL_REGEX, message: "Enter an email like name@company.com" },
                  })}
                />
              </FormField>

              <FormField id="contact" label="Mobile number" error={errors.contact?.message}>
                <div className="prefix-wrap">
                  <span className="prefix">
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
                          className="flex items-center justify-between gap-1 bg-transparent text-left text-sm outline-none cursor-pointer"
                          panelClassName="w-64 max-w-[calc(100vw-2.5rem)] sm:w-80"
                          displayValueOnly
                        />
                      )}
                    />
                  </span>
                  <input
                    id="contact"
                    type="tel"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    autoComplete="tel-national"
                    aria-invalid={!!errors.contact}
                    readOnly={isEdit}
                    {...contactField}
                    onChange={(e) => {
                      if (values.countryCode === "+91") {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                        e.target.value = d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
                      }
                      return contactField.onChange(e);
                    }}
                  />
                </div>
              </FormField>

              {!isEdit && <div>
                <div className="row">
                  <FormField id="password" label="Password" error={errors.password?.message}>
                    <div className="pw-wrap">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        aria-invalid={!!errors.password}
                        {...passwordField}
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowPassword((v) => !v)}>
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </FormField>
                  <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
                    <div className="pw-wrap">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                        aria-invalid={!!errors.confirmPassword}
                        {...field("confirmPassword", {
                          required: isEdit ? false : "Repeat your password",
                          validate: (val) => isEdit || val === passwordVal || "Passwords don’t match",
                        })}
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowConfirmPassword((v) => !v)}>
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </FormField>
                </div>
                {!errors.password && (
                  <p className="msg" style={{ marginTop: 6 }}>At least 8 characters with an uppercase letter, a number and a special character</p>
                )}
                {passwordVal && <PasswordStrengthMeter value={passwordVal} rules={REGISTRATION_PASSWORD_RULES} />}
              </div>}

              <FormField
                id="vouch"
                label="Who vouched for you? (optional)"
                hint="Applications with a vouch are reviewed first."
              >
                <input id="vouch" type="text" placeholder="Member name or invite code" {...field("vouch")} />
              </FormField>

              <div>
                <label className="check">
                  <Controller
                    control={control}
                    name="termsAccepted"
                    rules={{ required: "Please accept the Terms of membership and Privacy policy." }}
                    render={({ field: termsField }) => (
                      <input
                        type="checkbox"
                        readOnly
                        checked={!!termsField.value}
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsOpen(true);
                        }}
                      />
                    )}
                  />
                  <span>
                    I agree to the{" "}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTermsOpen(true);
                      }}
                    >
                      Terms of membership
                    </a>{" "}
                    and{" "}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTermsOpen(true);
                      }}
                    >
                      Privacy policy
                    </a>
                    .
                  </span>
                </label>
                {errors.termsAccepted?.message && (
                  <p className="msg" style={{ color: "var(--error)", marginTop: 6 }}>{errors.termsAccepted.message}</p>
                )}
              </div>

              <TermsModal
                open={termsOpen}
                onClose={() => setTermsOpen(false)}
                onAgree={() => {
                  setValue("termsAccepted", true, { shouldValidate: true });
                  setTermsOpen(false);
                }}
              />

              <button
                className="btn primary block"
                type="submit"
                disabled={isSubmitting || !isValid || missing.length > 0}
              >
                {isSubmitting ? <span className="spin" /> : "Continue"}
              </button>
              <p className="helper-missing" aria-live="polite">{missingText}</p>
              {!isEdit && (
                <p className="signin">
                  Already a member? <Link href="/login" className="link">Sign in</Link>
                </p>
              )}
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Prototype `.field` block: label, control, then a message line that doubles as the error. */
function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      <p className="msg" id={`${id}-msg`}>{error || hint || ""}</p>
    </div>
  );
}

