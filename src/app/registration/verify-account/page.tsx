"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Icon } from "@/components/ui/Icon";
import { FocusedHeader } from "@/components/onboarding/FocusedHeader";
import { OtpInput } from "@/components/onboarding/OtpInput";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { toast } from "sonner";
import { verifyMobileOtp, verifyEmailOtp, resendOtp } from "@/services/auth.service";
import { maskPhone, maskEmail } from "@/lib/mask";
import { OTP_LENGTH } from "@/lib/validation";
import type { ApiError } from "@/lib/axios";

const RESEND_SECONDS = 60;

/** react-hook-form shape: one digit array per OTP channel. */
interface VerifyForm {
  mobileOtp: string[];
  emailOtp: string[];
}

/**
 * Self-contained resend control: starts a countdown on mount, shows the timer
 * while active, swaps to a Resend button at 0, and restarts on a successful
 * resend. Each instance owns its timer, so multiple channels stay independent.
 * Occupies a fixed-width slot so the timer→button swap doesn't shift layout.
 * Exported so the login MFA verify-otp screen can reuse the same control.
 */
export function ResendControl({
  onResend,
  seconds: initialSeconds = RESEND_SECONDS,
}: {
  onResend: () => Promise<void>;
  seconds?: number;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleResend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await onResend();
      // Only restart the cooldown when the resend actually succeeded.
      setSeconds(initialSeconds);
    } catch {
      // Leave the button active so the user can retry.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-w-[10px] items-center justify-center font-label text-sm font-semibold text-on-surface-variant">
      {seconds > 0 ? (
        <span>
          <span className="font-bold text-on-surface">0:{String(seconds).padStart(2, "0")}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="rounded-full  px-3 py-1 font-bold text-primary transition-colors hover:bg-surface-container disabled:opacity-60"
        >
          {sending ? "Sending…" : "Resend"}
        </button>
      )}
    </div>
  );
}

export default function VerifyAccountPage() {
  const { data, setData, goNext, isDataLoaded } = useOnboarding();

  const { control, setValue } = useForm<VerifyForm>({
    defaultValues: {
      mobileOtp: Array(OTP_LENGTH).fill(""),
      emailOtp: Array(OTP_LENGTH).fill(""),
    },
  });

  const [mobileVerified, setMobileVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingMobile, setVerifyingMobile] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const bothVerified = mobileVerified && emailVerified;
  const maskedMobile = `${String(data.countryCode ?? "")} ${maskPhone(String(data.contact ?? ""))}`.trim();
  const maskedEmail = maskEmail(String(data.email ?? ""));

  // Login MFA may land here with one channel already verified — seed that so we
  // don't ask for (or send) an OTP the user already completed.
  useEffect(() => {
    if (!isDataLoaded) return;
    if (data.isPhoneVerified) setMobileVerified(true);
    if (data.isEmailVerified) setEmailVerified(true);
  }, [isDataLoaded, data.isPhoneVerified, data.isEmailVerified]);

  // Same combined toast registration uses: "Email OTP - 1234 | Phone OTP - 5678".
  // MFA stores it on onboarding data so it appears here (the OTP-entry screen),
  // not on the login MFA page the user just left.
  useEffect(() => {
    if (!isDataLoaded) return;
    const message = data.pendingOtpToast;
    if (typeof message !== "string" || !message) return;
    const toastKey = "bridge.pending-otp-toast";
    try {
      // Strict Mode remounts this effect; don't flash the same OTP toast twice.
      if (sessionStorage.getItem(toastKey) === message) {
        setData({ pendingOtpToast: undefined });
        return;
      }
      sessionStorage.setItem(toastKey, message);
    } catch {
      /* sessionStorage may be unavailable; still toast. */
    }
    toast.success(message);
    setData({ pendingOtpToast: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded]);

  // After login MFA the registration OTPs are not the ones from signup. Trigger a
  // send for each still-unverified channel. 429 = cooldown / backend already sent.
  useEffect(() => {
    if (!isDataLoaded) return;
    if (!data.needsChannelOtps) return;

    const email = String(data.email ?? "");
    const phone = String(data.contact ?? "");
    const guardKey = "bridge.trigger-channel-otps";
    try {
      if (sessionStorage.getItem(guardKey) === email) {
        setData({ needsChannelOtps: false });
        return;
      }
      sessionStorage.setItem(guardKey, email);
    } catch {
      /* sessionStorage may be unavailable; still attempt the send. */
    }

    let cancelled = false;

    const sendPending = async () => {
      const parts: string[] = [];

      if (!data.isEmailVerified && email) {
        try {
          const res = await resendOtp({ channel: "EMAIL", email });
          if (res.message) parts.push(`Email ${res.message}`);
        } catch (err) {
          if (!cancelled && (err as ApiError).status !== 429) {
            toast.error((err as ApiError).message ?? "Couldn't send email OTP. Please try again.");
          }
        }
      }

      if (!data.isPhoneVerified && phone) {
        try {
          const res = await resendOtp({ channel: "PHONE", phoneNumber: phone });
          if (res.message) parts.push(`Phone ${res.message}`);
        } catch (err) {
          if (!cancelled && (err as ApiError).status !== 429) {
            toast.error((err as ApiError).message ?? "Couldn't send mobile OTP. Please try again.");
          }
        }
      }

      if (!cancelled && parts.length > 0) toast.success(parts.join(" | "));
      if (!cancelled) setData({ needsChannelOtps: false });
    };

    void sendPending();
    return () => {
      cancelled = true;
    };
    // Wait for persisted onboarding data before reading email/phone/flags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded]);

  // Both channels verified → user clicks Continue to advance to complete-profile.
  const handleContinue = () => {
    if (!bothVerified) {
      toast.error("Please verify both your mobile and email OTP to continue.");
      return;
    }
    goNext("verification");
  };

  const verifyMobile = async (otp: string) => {
    setMobileError(null);
    setVerifyingMobile(true);
    try {
      const res = await verifyMobileOtp({ channel: "PHONE", phoneNumber: String(data.contact ?? ""), otp });
      toast.success(res.message ?? "Mobile OTP verified.");
      setMobileVerified(true);
    } catch (err) {
      toast.error((err as ApiError).message ?? "Verification failed. Please try again.");
      setMobileError("Verification failed");
    } finally {
      setVerifyingMobile(false);
    }
  };

  const verifyEmail = async (otp: string) => {
    setEmailError(null);
    setVerifyingEmail(true);
    try {
      const res = await verifyEmailOtp({ channel: "EMAIL", email: String(data.email ?? ""), otp });
      toast.success(res.message ?? "Email OTP verified.");
      setEmailVerified(true);
    } catch (err) {
      toast.error((err as ApiError).message ?? "Verification failed. Please try again.");
      setEmailError("Verification failed");
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Auto-trigger verification once all digits are entered (no Verify button).
  // `onChange` is RHF's field updater from the Controller.
  const handleMobileChange = (next: string[], onChange: (v: string[]) => void) => {
    onChange(next);
    if (mobileVerified || verifyingMobile) return;
    if (next.join("").length === OTP_LENGTH) verifyMobile(next.join(""));
  };

  const handleEmailChange = (next: string[], onChange: (v: string[]) => void) => {
    onChange(next);
    if (emailVerified || verifyingEmail) return;
    if (next.join("").length === OTP_LENGTH) verifyEmail(next.join(""));
  };

  const handleResendMobileOtp = async () => {
    try {
      const res = await resendOtp({ channel: "PHONE", phoneNumber: String(data.contact ?? "") });
      toast.success(res.message ?? "OTP resent to your mobile.");
      setValue("mobileOtp", Array(OTP_LENGTH).fill(""));
      setMobileError(null);
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't resend OTP. Please try again.");
      // Re-throw so ResendControl keeps the button active (cooldown not reset).
      throw err;
    }
  };

  const handleResendEmailOtp = async () => {
    try {
      const res = await resendOtp({ channel: "EMAIL", email: String(data.email ?? "") });
      toast.success(res.message ?? "OTP resent to your email.");
      setValue("emailOtp", Array(OTP_LENGTH).fill(""));
      setEmailError(null);
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't resend OTP. Please try again.");
      // Re-throw so ResendControl keeps the button active (cooldown not reset).
      throw err;
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-[560px] rounded-2xl bg-surface-container-lowest ambient-shadow border border-white/40 flex flex-col gap-3 !p-6 sm:!p-8 lg:gap-6 lg:!p-8">
        <FocusedHeader backHref="/registration" />

        <div className="mb-3 text-center">
          <h1 className="mb-3 font-headline text-2xl font-extrabold leading-tight tracking-[-0.02em] text-on-surface md:text-[28px]">
            Secure your account
          </h1>
          <p className="mx-auto max-w-sm text-base leading-relaxed text-on-surface-variant">
            {bothVerified
              ? "Both your mobile and email are verified."
              : <>We&apos;ve sent a 4-digit code to your mobile phone {maskedMobile} and email {maskedEmail}.</>}
          </p>
        </div>

        <div className="space-y-6">
          {/* <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 font-label text-sm font-semibold text-on-surface-variant">
            <Icon name="smartphone" size={16} /> Mobile OTP
          </label>
          <OtpInput value={mobileOtp} onChange={setMobileOtp} />
        </div> */}

          <div className="flex flex-col items-center gap-4">
            <div className="flex w-[240px] flex-col gap-3 md:w-[304px]">
              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 font-label text-sm font-semibold text-on-surface-variant">
                  <Icon name="smartphone" size={16} />
                  Mobile OTP
                </label>

                {!mobileVerified && <ResendControl onResend={handleResendMobileOtp} />}
              </div>

              <Controller
                control={control}
                name="mobileOtp"
                render={({ field }) => (
                  <OtpInput
                    value={field.value}
                    onChange={(next) => handleMobileChange(next, field.onChange)}
                    disabled={mobileVerified}
                  />
                )}
              />

              {mobileVerified ? (
                <span className="flex items-center gap-1 px-1 text-xs font-medium text-primary">
                  <Icon name="check_circle" size={16} />OTP Verified Successfully
                </span>
              ) : verifyingMobile ? (
                <span className="px-1 text-xs font-medium text-on-surface-variant">Verifying…</span>
              ) : mobileError ? (
                <span className="px-1 text-xs font-medium text-error">{mobileError}</span>
              ) : null}
            </div>
          </div>


          {/* <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 font-label text-sm font-semibold text-on-surface-variant">
            <Icon name="mail" size={16} /> Email OTP
          </label>
          <OtpInput value={emailOtp} onChange={setEmailOtp} />
        </div> */}

          <div className="flex flex-col items-center gap-4">
            <div className="flex w-[240px] flex-col gap-3 md:w-[304px]">
              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 font-label text-sm font-semibold text-on-surface-variant">
                  <Icon name="mail" size={16} />
                  Email OTP
                </label>

                {!emailVerified && <ResendControl onResend={handleResendEmailOtp} />}
              </div>

              <Controller
                control={control}
                name="emailOtp"
                render={({ field }) => (
                  <OtpInput
                    value={field.value}
                    onChange={(next) => handleEmailChange(next, field.onChange)}
                    disabled={emailVerified}
                  />
                )}
              />

              {emailVerified ? (
                <span className="flex items-center gap-1 px-1 text-xs font-medium text-primary">
                  <Icon name="check_circle" size={16} />OTP Verified Successfully
                </span>
              ) : verifyingEmail ? (
                <span className="px-1 text-xs font-medium text-on-surface-variant">Verifying…</span>
              ) : emailError ? (
                <span className="px-1 text-xs font-medium text-error">{emailError}</span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!bothVerified}
          className="cta-gradient flex h-12 w-full items-center justify-center gap-2 bg-primary rounded-xl font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none"
        >
          Continue
        </button>
      </div>
    </main>
  );
}
