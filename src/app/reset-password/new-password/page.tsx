"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordScreen } from "@/components/auth/ResetPasswordScreen";

/**
 * Step 3 of the standalone password-reset flow. The originating portal is carried
 * via the `from` query param so cancel / success links return to the right portal.
 */
function ResetNewPassword() {
  const from = useSearchParams().get("from") || "/login";
  return <ResetPasswordScreen from={from} />;
}

export default function ResetNewPasswordPage() {
  return (
    <Suspense>
      <ResetNewPassword />
    </Suspense>
  );
}
