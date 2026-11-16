"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Loader } from "@/components/common/loader";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { PASSWORD_RULES, PasswordStrengthMeter, metRuleCount } from "@/components/auth/PasswordStrength";
import { resetPassword } from "@/services/auth.service";
import { MEMBER_PASSWORD_MESSAGE } from "@/lib/validation";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

const fieldCls = (hasError: boolean) =>
  `min-h-[42px] w-full rounded-lg border bg-white px-3 py-2.5 !pr-14 text-sm leading-[1.4] text-[#1A1F2B] transition-[border-color,box-shadow] placeholder:text-[#8A93A0] hover:border-[#B4BDC9] focus:border-[#0C56D0] focus:outline-none focus:ring-[3px] focus:ring-[#EAF1FC] ${
    hasError ? "border-[#9F403D]" : "border-[#CFD6DF]"
  }`;

/** Password input with the prototype's "Show / Hide" text toggle. */
function PasswordField({
  id,
  label,
  placeholder,
  error,
  registration,
}: {
  id: string;
  label: string;
  placeholder: string;
  error?: string;
  registration: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold text-[#1A1F2B]">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          className={fieldCls(Boolean(error))}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1.5 text-xs font-semibold text-[#5B6472]"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p className="text-xs text-[#9F403D]">{error}</p>}
    </div>
  );
}

/**
 * Step 3 of the password-reset flow: choose a new password, in the same card as the rest of the member sign-in
 * (design prototype). The reset is authorized by the short-lived reset token cookie set at the verify step (sent
 * automatically by the browser). On success the backend clears that cookie itself; here we just reset the local
 * flow data and advance to the success screen. `from` is the originating portal sign-in (for the back / success
 * links).
 */
export function ResetPasswordScreen({ from = "/login" }: { from?: string }) {
  const router = useRouter();
  const { reset: resetOnboarding } = useOnboarding();

  const fromQuery = `?from=${encodeURIComponent(from)}`;

  const {
    register: field,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<ResetPasswordForm>({
    mode: "onChange",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";
  const confirmPassword = useWatch({ control, name: "confirmPassword" }) ?? "";

  const allMet = metRuleCount(newPassword) === PASSWORD_RULES.length;
  const matches = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = allMet && matches && !isSubmitting;

  const onSubmit = async (values: ResetPasswordForm) => {
    try {
      const res = await resetPassword({ newPassword: values.newPassword });
      resetOnboarding();
      toast.success(res.message ?? SUCCESS_MESSAGES.RESET_PASSWORD_SUCCESS);
      router.push(`/reset-password/success${fromQuery}`);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        toast.error("Your verification has expired. Please restart the password reset process.");
        router.push(`/reset-password${fromQuery}`);
        return;
      }
      toast.error(apiErr.message ?? ERROR_MESSAGES.RESET_PASSWORD_FAILED);
    }
  };

  return (
    <div className="min-h-full bg-[#F6F8FA] px-4 py-8 sm:px-6 sm:py-10">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mx-auto flex w-full max-w-[470px] flex-col gap-[18px] rounded-[14px] border border-[#E3E8EE] bg-white p-[22px_18px] shadow-[0_10px_30px_rgba(26,31,43,.08)] sm:rounded-2xl sm:p-8"
      >
        <Link
          href={from}
          className="inline-flex items-center gap-1.5 self-start py-0.5 text-[13px] font-semibold text-[#1A1F2B] hover:text-[#0C56D0]"
        >
          <Icon name="chevron_left" size={14} />
          Back to sign in
        </Link>

        <div>
          <h2 className="font-headline text-[22px] font-bold tracking-[-0.01em] text-[#1A1F2B]">Choose a new password</h2>
          <p className="mt-1 text-[13px] text-[#5B6472]">Pick a password you have not used with Bridge before.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <PasswordField
            id="newPassword"
            label="New password"
            placeholder="Create a password"
            registration={field("newPassword", { required: true })}
          />
          {newPassword ? (
            <PasswordStrengthMeter value={newPassword} />
          ) : (
            <p className="text-xs text-[#5B6472]">{MEMBER_PASSWORD_MESSAGE}</p>
          )}
        </div>

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          placeholder="Repeat the password"
          error={confirmPassword.length > 0 && !matches ? "Passwords don’t match." : undefined}
          registration={field("confirmPassword", { required: true })}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#0C56D0] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0A49B0] active:bg-[#083C92] disabled:cursor-not-allowed disabled:bg-[#A8BFE8]"
        >
          {isSubmitting ? <Loader size={18} /> : "Reset password"}
        </button>
      </form>
    </div>
  );
}
