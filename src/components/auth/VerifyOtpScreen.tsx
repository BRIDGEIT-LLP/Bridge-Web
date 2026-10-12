"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OtpVerifyCard } from "@/components/auth/OtpVerifyCard";
import { SessionChooserModal } from "@/components/auth/SessionChooserModal";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { verifyMfaOtp, selectMfaChannel, type Portal } from "@/services/auth.service";
import { getSessionLimitStatus, revokeSelectedSessions } from "@/services/session.service";
import { OTP_LENGTH, type OtpChannel } from "@/lib/validation";
import { normalizeRole } from "@/lib/roles";
import { getSession, setSession } from "@/lib/auth-session";
import { ERROR_MESSAGES } from "@/lib/messages";
import type { ActiveSession } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

// Fallback landing route if the verify response doesn't supply a redirectRoute.
const SUCCESS_ROUTE = "/dashboard";

/**
 * Shared MFA OTP-entry screen for every portal (user, admin, superadmin). Props
 * select the route prefix and backend endpoint; defaults serve the normal `/login`
 * portal. The post-verification landing route is decided by the backend
 * (`redirectRoute`), with a dashboard fallback — so each portal lands wherever its
 * backend says. The OTP card markup is shared with the reset flow via `OtpVerifyCard`.
 *
 * After OTP verification the screen checks the active-session limit before
 * redirecting — for ALL portals, not just the user portal:
 *   • atLimit: false → redirect to dashboard as normal.
 *   • atLimit: true  → open the SessionChooserModal so the user/admin can revoke an
 *                       existing device, then proceed to the dashboard.
 *
 * The modal receives a portal-aware `onRevoke` callback so it stays portal-agnostic
 * internally. The correct session endpoint (user vs admin) is selected here.
 */
export function VerifyOtpScreen({
  basePath = "/login",
  portal = "user",
}: {
  basePath?: string;
  portal?: Portal;
}) {
  const router = useRouter();
  const { data, setData } = useOnboarding();

  // Which channel the user picked on the previous screen.
  const channel = (data.mfaChannel as OtpChannel) ?? "PHONE";
  // Both values arrive already masked from the login API; show them as-is.
  const maskedMobile = String(data.maskedMobile ?? "");
  const maskedEmail = String(data.maskedEmail ?? "");

  const isPhone = channel === "PHONE";
  const maskedTarget = isPhone ? maskedMobile : maskedEmail;

  // Session-limit check state — populated after OTP verification succeeds.
  const [redirectRoute, setRedirectRoute] = useState<string | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  const handleVerify = async (code: string) => {
    // MFA passed — the backend sets the full access+refresh token pair as httpOnly
    // cookies directly on this response; nothing for the client to store. It also
    // echoes userId/tokenType in the body since the client can no longer decode the
    // (now-invisible) cookie itself.
    const res = await verifyMfaOtp({ channel, otp: code }, portal);
    const destination = res.data?.redirectRoute || SUCCESS_ROUTE;
    setRedirectRoute(destination);

    // The registration pages (verify-account, complete-profile) need the real
    // (unmasked) email/mobile/company name/role for their locked fields and resend/verify
    // calls — the login flow never captures those otherwise (SignInScreen only stores masked
    // display strings), so persist them here whenever the backend echoes them back. This is
    // what a returning user on a fresh session/device (no registration-wizard localStorage)
    // relies on instead of a blank field.
    const nextRole = normalizeRole(res.data?.role);
    const goingToVerifyAccount = destination.startsWith("/registration/verify-account");
    if (res.data?.email || res.data?.mobileNumber || res.data?.companyName || nextRole || goingToVerifyAccount) {
      setData({
        email: res.data?.email,
        contact: res.data?.mobileNumber,
        countryCode: res.data?.countryCode,
        legalName: res.data?.companyName,
        isEmailVerified: Boolean(res.data?.isEmailVerified),
        isPhoneVerified: Boolean(res.data?.isPhoneVerified),
        // Toast on verify-account (same combined "Email OTP - x | Phone OTP - y"
        // string registration uses). Shown there so it stays visible on the OTP screen.
        pendingOtpToast: res.data?.channelOtpMessage,
        // Fallback send on verify-account only when MFA didn't actually deliver a
        // registration OTP for an still-unverified channel (cooldown / send failure).
        needsChannelOtps:
          goingToVerifyAccount &&
          ((!Boolean(res.data?.isEmailVerified) && !res.data?.emailOtpMessage) ||
            (!Boolean(res.data?.isPhoneVerified) && !res.data?.phoneOtpMessage)),
        ...(nextRole ? { role: nextRole } : {}),
      });
    }

    // Persist the real name + role echoed back here so the dashboard sidebar shows
    // the actual signed-in user (login only had the email at that point). The
    // dashboard's AuthProvider reads this from localStorage on mount.
    const current = getSession();
    const fullName = [res.data?.first_name, res.data?.last_name].filter(Boolean).join(" ").trim();
    const sessionRole = nextRole ?? current?.role ?? null;
    if (sessionRole) {
      setSession({
        role: sessionRole,
        user: { ...current?.user, name: fullName || current?.user?.name },
        userId: res.data?.userId ?? current?.userId,
        tokenType: res.data?.tokenType ?? current?.tokenType,
      });
    }

    // Check the active-session limit before redirecting — applies to ALL portals.
    // The portal parameter selects the correct backend endpoint:
    //   user      → GET /api/v1/sessions/limit-status
    //   admin     → GET /api/v1/admin/sessions/limit-status
    //   superadmin→ GET /api/v1/admin/sessions/limit-status

    // Falls back to a normal redirect on check failure so OTP verification is
    // never blocked by a secondary service outage.
    try {
      const limitRes = await getSessionLimitStatus(portal);
      if (limitRes.data?.atLimit) {
        setActiveSessions(limitRes.data.activeSessions ?? []);
        setSessionModalOpen(true);
      } else {
        router.push(destination);
      }
    } catch (err) {
      toast.error((err as ApiError).message ?? ERROR_MESSAGES.SESSION_LIMIT_FETCH_FAILED);
      router.push(destination);
    }

    return { message: res.message ?? undefined };
  };

  // Resend re-triggers the OTP for the same channel via the MFA endpoint.
  const handleResend = async () => {
    try {
      const res = await selectMfaChannel({ channel }, portal);
      toast.success(res.message ?? "Verification code resent.");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't resend OTP. Please try again.");
      // Re-throw so ResendControl keeps the button active (cooldown not reset).
      throw err;
    }
  };

  /**
   * Portal-aware revoke callback passed to SessionChooserModal.
   * The modal is portal-agnostic — it just calls this with the selected IDs;
   * the correct endpoint (user vs admin) is selected by `portal` here.
   */
  const handleRevoke = async (sessionIds: string[]) => {
    await revokeSelectedSessions({ sessionIds }, portal);
  };

  // Modal cancel — user abandons login; send them back to the login page.
  const handleModalCancel = () => {
    setSessionModalOpen(false);
    router.push(basePath);
  };

  // Modal success — sessions revoked; proceed to the dashboard as normal.
  const handleModalSuccess = () => {
    setSessionModalOpen(false);
    router.push(redirectRoute || SUCCESS_ROUTE);
  };

  return (
    <>
      <OtpVerifyCard
        title={`Verify your ${isPhone ? "mobile" : "email"}`}
        subtitle={
          <>
            We&apos;ve sent a {OTP_LENGTH}-digit code to your{" "}
            {isPhone ? "mobile phone" : "email"} {maskedTarget}.
          </>
        }
        backHref={`${basePath}/select-channel`}
        channelIcon={isPhone ? "smartphone" : "mail"}
        channelLabel={isPhone ? "Mobile OTP" : "Email OTP"}
        onVerify={handleVerify}
        onResend={handleResend}
      />

      {/* Rendered outside OtpVerifyCard so it portal-mounts cleanly to document.body */}
      <SessionChooserModal
        open={sessionModalOpen}
        sessions={activeSessions}
        onRevoke={handleRevoke}
        onCancel={handleModalCancel}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}
