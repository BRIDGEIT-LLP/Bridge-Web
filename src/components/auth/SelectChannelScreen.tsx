"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Loader } from "@/components/common/loader";
import { SelectableOptionRow } from "@/components/ui/SelectableOptionRow";
import { FocusedHeader } from "@/components/onboarding/FocusedHeader";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { selectMfaChannel, type Portal } from "@/services/auth.service";
import { type OtpChannel } from "@/lib/validation";
import type { ApiError } from "@/lib/axios";

/**
 * Shared MFA channel-selection screen for every portal. Props select the route
 * prefix and backend endpoint; defaults serve the normal `/login` portal. On
 * success it advances to the portal's OTP-entry step.
 */
export function SelectChannelScreen({
  basePath = "/login",
  portal = "user",
}: {
  basePath?: string;
  portal?: Portal;
}) {
  const router = useRouter();
  const { data, setData } = useOnboarding();
  const [channel, setChannel] = useState<OtpChannel>("PHONE");
  const [sending, setSending] = useState(false);

  // Both values arrive already masked from the login API; show them as-is.
  const maskedMobile = String(data.maskedMobile ?? "");
  const maskedEmail = String(data.maskedEmail ?? "");

  const handleContinue = async () => {
    if (sending) return;
    setSending(true);
    try {
      // Send only the chosen channel; the backend triggers the OTP send.
      const res = await selectMfaChannel({ channel }, portal);
      // Persist the chosen channel so the verify-otp page knows which one to show.
      setData({ mfaChannel: channel });
      toast.success(res.message ?? "Verification code sent.");
      router.push(`${basePath}/verify-otp`);
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't send the code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
      <Card padding="lg" className="flex w-full max-w-[480px] flex-col gap-5 !p-6 sm:!p-8">
        <FocusedHeader backLabel="Back to Login" backHref={basePath} />

        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-[28px]">
            Choose Verification Method
          </h1>
          <p className="mt-2 text-base leading-relaxed text-on-surface-variant">
            Select how you would like to receive your one-time verification code.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SelectableOptionRow
            icon="smartphone"
            title="Send OTP to Mobile"
            subtitle={maskedMobile}
            selected={channel === "PHONE"}
            onSelect={() => setChannel("PHONE")}
          />
          <SelectableOptionRow
            icon="mail"
            title="Send OTP to Email"
            subtitle={maskedEmail}
            selected={channel === "EMAIL"}
            onSelect={() => setChannel("EMAIL")}
          />
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={sending}
          className="cta-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? (
            <Loader size={18} />
          ) : (
            <>
              Continue
              <Icon name="arrow_forward" size={20} />
            </>
          )}
        </button>
      </Card>
    </main>
  );
}
