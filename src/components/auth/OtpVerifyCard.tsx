"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader } from "@/components/common/loader";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { FocusedHeader } from "@/components/onboarding/FocusedHeader";
import { OtpInput } from "@/components/onboarding/OtpInput";
import { ResendControl } from "@/app/registration/verify-account/page";
import { OTP_LENGTH } from "@/lib/validation";
import type { ApiError } from "@/lib/axios";

interface OtpVerifyCardProps {
  title: string;
  subtitle: ReactNode;
  backLabel?: string;
  backHref: string;
  /** Icon + label for the OTP field row (e.g. "mail" / "Email OTP"). */
  channelIcon?: string;
  channelLabel: string;
  /**
   * Verify the entered code. Implementations perform the API call AND any
   * navigation/side effects on success, and throw an `ApiError` on failure.
   * The optional returned message is shown next to the success checkmark.
   */
  onVerify: (code: string) => Promise<{ message?: string } | void>;
  /** Re-trigger the OTP send. Throws to keep the resend button active. */
  onResend: () => Promise<void>;
  /**
   * Overrides the "Verify and Continue" button's className. Defaults to the
   * original gradient/glow treatment so password-reset keeps its current look;
   * the login-MFA screen opts into the flat UX-proposal button via this prop.
   */
  continueButtonClassName?: string;
  /**
   * "prototype" renders the member sign-in code step from the design prototype: a narrow
   * card with a single numeric "Code" field and a "Verify and sign in" button (explicit
   * click, no auto-verify). Default keeps the OTP-box layout used by password reset.
   */
  variant?: "default" | "prototype";
}

const DEFAULT_CONTINUE_BUTTON_CLASSNAME =
  "cta-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Presentational OTP-entry card shared by the login-MFA verify screen and the
 * password-reset verify screen. Owns the OTP input state and auto-verifies once
 * all digits are entered; all endpoint/navigation differences are injected via
 * `onVerify` / `onResend`, so neither flow duplicates this markup.
 */
export function OtpVerifyCard({
  title,
  subtitle,
  backLabel = "Back",
  backHref,
  channelIcon = "mail",
  channelLabel,
  onVerify,
  onResend,
  continueButtonClassName = DEFAULT_CONTINUE_BUTTON_CLASSNAME,
  variant = "default",
}: OtpVerifyCardProps) {
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const verify = async (code: string) => {
    setError(null);
    setVerifying(true);
    try {
      const res = await onVerify(code);
      setMessage(res?.message ?? null);
      setVerified(true);
    } catch (err) {
      const apiErr = err as ApiError;
      // Member sign-in: a 401 here means there is no valid pre-MFA session (the account
      // doesn't exist, or the session lapsed). The backend deliberately doesn't say which,
      // so show the same line as a wrong code instead of "Unauthorized: No access token".
      setError(
        variant === "prototype" && apiErr.status === 401
          ? "That code doesn’t match. Try again."
          : apiErr.message ?? "Verification failed. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  // Auto-verify once all digits are entered (no Verify button), same as registration.
  const handleChange = (next: string[]) => {
    setOtp(next);
    if (verified || verifying) return;
    if (next.join("").length === OTP_LENGTH) verify(next.join(""));
  };

  const handleResend = async () => {
    await onResend();
    setOtp(Array(OTP_LENGTH).fill(""));
    setCode("");
    setError(null);
  };

  if (variant === "prototype") {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      if (verified || verifying) return;
      if (code.length !== OTP_LENGTH) {
        setError("That code doesn’t match. Try again.");
        return;
      }
      verify(code);
    };

    return (
      <div className="min-h-full bg-[#F6F8FA] px-4 py-8 sm:px-6 sm:py-10">
        <form
          onSubmit={submit}
          noValidate
          className="mx-auto flex w-full max-w-[470px] flex-col gap-[18px] rounded-[14px] border border-[#E3E8EE] bg-white p-[22px_18px] shadow-[0_10px_30px_rgba(26,31,43,.08)] sm:rounded-2xl sm:p-8"
        >
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 self-start py-0.5 text-[13px] font-semibold text-[#1A1F2B] hover:text-[#0C56D0]"
          >
            <Icon name="chevron_left" size={14} />
            {backLabel}
          </Link>

          <div>
            <h2 className="font-headline text-[22px] font-bold tracking-[-0.01em] text-[#1A1F2B]">{title}</h2>
            <p className="mt-1 text-[13px] text-[#5B6472]">{subtitle}</p>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="siCode" className="text-[12.5px] font-semibold text-[#1A1F2B]">Code</label>
              {!verified && <ResendControl onResend={handleResend} />}
            </div>
            <input
              id="siCode"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
                setError(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="1234"
              className={`min-h-[42px] w-full rounded-lg border bg-white px-3 py-2.5 text-sm leading-[1.4] text-[#1A1F2B] placeholder:text-[#8A93A0] hover:border-[#B4BDC9] focus:border-[#0C56D0] focus:outline-none focus:ring-[3px] focus:ring-[#EAF1FC] ${
                error ? "border-[#9F403D]" : "border-[#CFD6DF]"
              }`}
            />
            {error && <p className="text-xs text-[#9F403D]">{error}</p>}
            {verified && <p className="text-xs font-semibold text-[#1F7A4D]">{message ?? "OTP Verified"}</p>}
          </div>

          <button
            type="submit"
            disabled={verified || verifying}
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#0C56D0] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0A49B0] active:bg-[#083C92] disabled:cursor-not-allowed disabled:bg-[#A8BFE8]"
          >
            {verifying ? <Loader size={18} /> : "Verify and sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
      <Card padding="lg" className="flex w-full max-w-[480px] flex-col gap-6 !p-6 sm:!p-8">
        <FocusedHeader backLabel={backLabel} backHref={backHref} />

        <div className="text-center">
          <h1 className="mb-3 font-headline text-2xl font-extrabold leading-tight tracking-[-0.02em] text-on-surface md:text-[28px]">
            {title}
          </h1>
          <p className="mx-auto max-w-sm text-base leading-relaxed text-on-surface-variant">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex w-[240px] flex-col gap-3 md:w-[304px]">
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 font-label text-sm font-semibold text-on-surface-variant">
                <Icon name={channelIcon} size={16} />
                {channelLabel}
              </label>

              {!verified && <ResendControl onResend={handleResend} />}
            </div>

            <OtpInput value={otp} onChange={handleChange} error={!!error} />

            {verified ? (
              <span className="flex items-center gap-1 px-1 text-xs font-medium text-primary">
                <Icon name="check_circle" size={16} />
                {message ?? "OTP Verified"}
              </span>
            ) : verifying ? (
              <span className="px-1 text-xs font-medium text-on-surface-variant">Verifying…</span>
            ) : error ? (
              <span className="px-1 text-xs font-medium text-error">{error}</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => verify(otp.join(""))}
          disabled={verified || verifying || otp.join("").length !== OTP_LENGTH}
          className={continueButtonClassName}
        >
          Verify and Continue
        </button>
      </Card>
    </main>
  );
}
