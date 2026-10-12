"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ForgotPasswordScreen } from "@/components/auth/ForgotPasswordScreen";

/**
 * Entry step of the standalone password-reset flow. Shared across every portal:
 * the originating sign-in page is passed via the `from` query param so the
 * "back to sign in" links return to the right portal (defaults to /login).
 */
function ResetPasswordRequest() {
  const from = useSearchParams().get("from") || "/login";
  return <ForgotPasswordScreen basePath={from} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordRequest />
    </Suspense>
  );
}
