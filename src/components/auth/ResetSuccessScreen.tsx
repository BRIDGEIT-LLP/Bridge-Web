"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Final screen of the password-reset flow, in the prototype's card style. Confirms the reset succeeded and routes the
 * user back to sign in. The `basePath` prop sets the route prefix so the button lands on the right portal's sign-in.
 */
export function ResetSuccessScreen({ basePath = "/login" }: { basePath?: string }) {
  return (
    <div className="min-h-full bg-[#F6F8FA] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[470px] flex-col gap-[18px] rounded-[14px] border border-[#E3E8EE] bg-white p-[22px_18px] shadow-[0_10px_30px_rgba(26,31,43,.08)] sm:rounded-2xl sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#EAF1FC] text-[#0C56D0]">
          <Icon name="check_circle" size={24} filled />
        </span>

        <div>
          <h2 className="font-headline text-[22px] font-bold tracking-[-0.01em] text-[#1A1F2B]">Password updated</h2>
          <p className="mt-1 text-[13px] text-[#5B6472]">
            All active sessions have been signed out for your security. Sign in with your new password.
          </p>
        </div>

        <Link
          href={basePath}
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-[#CFD6DF] bg-white px-4 text-[13.5px] font-semibold text-[#1A1F2B] transition-colors hover:border-[#B4BDC9] hover:bg-[#F6F8FA]"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
