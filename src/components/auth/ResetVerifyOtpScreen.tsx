"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OtpVerifyCard } from "@/components/auth/OtpVerifyCard";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { verifyResetPasswordOtp, triggerResetPasswordOtp } from "@/services/auth.service";
import { maskEmail } from "@/lib/mask";
import { OTP_LENGTH } from "@/lib/validation";
import type { ApiError } from "@/lib/axios";

/**
 * Step 2 of the password-reset flow: verify the emailed OTP. Reuses the shared
 * `OtpVerifyCard`. On success the backend sets the short-lived reset token as an
 * httpOnly cookie directly on this response (nothing for the client to store —
 * the cookie authorizes step 3 automatically) and advances to the new-password
 * screen. `from` is the originating portal sign-in, threaded through for the
 * back / cancel links.
 */
export function ResetVerifyOtpScreen({ from = "/login" }: { from?: string }) {
  const router = useRouter();
  const { data } = useOnboarding();
  const resetEmail = String(data.resetEmail ?? "");

  const fromQuery = `?from=${encodeURIComponent(from)}`;

  // If we have no email (deep link / cleared storage), restart at the request step.
  useEffect(() => {
    if (!resetEmail) router.replace(`/reset-password${fromQuery}`);
  }, [resetEmail, router, fromQuery]);

  const handleVerify = async (code: string) => {
    // A wrong/expired OTP is a non-2xx response, already thrown by the axios
    // interceptor. Success sets the reset_token cookie directly — nothing to store.
    const res = await verifyResetPasswordOtp({ email: resetEmail, otp: code });
    router.push(`/reset-password/new-password${fromQuery}`);
    return { message: res.message ?? undefined };
  };

  const handleResend = async () => {
    try {
      const res = await triggerResetPasswordOtp({ email: resetEmail });
      toast.success(res.message ?? "We've resent the code to your email.");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't resend the code. Please try again.");
      throw err;
    }
  };

  return (
    <OtpVerifyCard
      title="Verify your email"
      subtitle={
        <>
          We&apos;ve sent a {OTP_LENGTH}-digit code to{" "}
          <span className="font-semibold text-on-surface">{maskEmail(resetEmail)}</span>.
        </>
      }
      backHref={`/reset-password${fromQuery}`}
      channelIcon="mail"
      channelLabel="Email OTP"
      onVerify={handleVerify}
      onResend={handleResend}
    />
  );
}
