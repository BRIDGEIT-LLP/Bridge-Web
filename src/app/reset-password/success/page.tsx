"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetSuccessScreen } from "@/components/auth/ResetSuccessScreen";

/**
 * Final step of the standalone password-reset flow. The originating portal is
 * carried through via the `from` query param so "Login Again" returns to the
 * right sign-in page (defaults to /login).
 */
function ResetPasswordSuccess() {
  const from = useSearchParams().get("from") || "/login";
  return <ResetSuccessScreen basePath={from} />;
}

export default function ResetSuccessPage() {
  return (
    <Suspense>
      <ResetPasswordSuccess />
    </Suspense>
  );
}
