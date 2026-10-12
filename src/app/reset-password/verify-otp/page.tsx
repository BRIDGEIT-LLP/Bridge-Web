"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetVerifyOtpScreen } from "@/components/auth/ResetVerifyOtpScreen";

/**
 * Step 2 of the standalone password-reset flow. The originating portal is carried
 * via the `from` query param so the back link returns to the right sign-in page.
 */
function ResetVerifyOtp() {
  const from = useSearchParams().get("from") || "/login";
  return <ResetVerifyOtpScreen from={from} />;
}

export default function ResetVerifyOtpPage() {
  return (
    <Suspense>
      <ResetVerifyOtp />
    </Suspense>
  );
}
