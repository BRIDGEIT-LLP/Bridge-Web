"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Loader } from "@/components/common/loader";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import {
  PASSWORD_RULES,
  PasswordRequirements,
  PasswordStrengthMeter,
  metRuleCount,
} from "@/components/auth/PasswordStrength";
import { resetPassword } from "@/services/auth.service";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

/**
 * Step 3 of the password-reset flow: choose a new password. Built from the Stitch
 * "Forgot Password – Reset" screen. The reset is authorized by the short-lived
 * reset token cookie set at the verify step (sent automatically by the browser).
 * On success the backend clears that cookie itself; here we just reset the local
 * flow data and advance to the success screen. `from` is the originating portal
 * sign-in (for the cancel / success links).
 */
export function ResetPasswordScreen({ from = "/login" }: { from?: string }) {
  const router = useRouter();
  const { reset: resetOnboarding } = useOnboarding();
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fromQuery = `?from=${encodeURIComponent(from)}`;

  const {
    register: field,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
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
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
      <Card padding="lg" className="w-full max-w-[480px] !p-8 sm:!p-10">
        <header className="mb-8">
          <h1 className="mb-2 font-headline text-3xl font-extrabold tracking-tight text-on-surface">
            Reset Password
          </h1>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Choose a secure password to protect your account.
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          {/* New Password */}
          <div className="space-y-2">
            <label
              htmlFor="newPassword"
              className="block font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNew ? "text" : "password"}
                placeholder="••••••••"
                className={`w-full rounded-xl border bg-surface-container-lowest px-4 py-3.5 pr-12 text-on-surface transition-all focus:outline-none focus:ring-4 focus:ring-primary/5 ${
                  newPassword.length > 0 && !allMet
                    ? "border-error/60 focus:border-error"
                    : "border-outline-variant/30 focus:border-primary"
                }`}
                {...field("newPassword", { required: true })}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={showNew ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-primary"
              >
                <Icon name={showNew ? "visibility_off" : "visibility"} size={20} />
              </button>
            </div>

            <PasswordStrengthMeter value={newPassword} />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="block font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                className={`w-full rounded-xl border bg-surface-container-lowest px-4 py-3.5 pr-12 text-on-surface transition-all focus:outline-none focus:ring-4 focus:ring-primary/5 ${
                  confirmPassword.length > 0 && !matches
                    ? "border-error/60 focus:border-error"
                    : "border-outline-variant/30 focus:border-primary"
                }`}
                {...field("confirmPassword", { required: true })}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-primary"
              >
                <Icon name={showConfirm ? "visibility_off" : "visibility"} size={20} />
              </button>
            </div>
            {confirmPassword.length > 0 && !matches && (
              <span className="px-1 text-xs font-medium text-error">Passwords don&apos;t match.</span>
            )}
          </div>

          {/* Requirements checklist */}
          <PasswordRequirements value={newPassword} />
          {errors.newPassword && newPassword.length === 0 && (
            <span className="px-1 text-xs font-medium text-error">Enter a new password.</span>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="cta-gradient flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader size={18} /> : "Reset Password"}
          </button>

          <Link
            href={from}
            className="block w-full py-2 text-center text-sm font-semibold text-outline transition-colors hover:text-on-surface"
          >
            Cancel and return to login
          </Link>
        </form>
      </Card>
    </main>
  );
}
