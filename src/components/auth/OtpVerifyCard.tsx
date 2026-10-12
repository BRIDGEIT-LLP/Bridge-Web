"use client";

import { useState, type ReactNode } from "react";
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
}

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
}: OtpVerifyCardProps) {
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
      setError((err as ApiError).message ?? "Verification failed. Please try again.");
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
    setError(null);
  };

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

            <OtpInput value={otp} onChange={handleChange} />

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
          className="cta-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          Verify and Continue
        </button>
      </Card>
    </main>
  );
}
