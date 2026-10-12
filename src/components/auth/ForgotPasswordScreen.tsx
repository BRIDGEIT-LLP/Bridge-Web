"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Loader } from "@/components/common/loader";
import { Input } from "@/components/ui/input";
import { FocusedHeader } from "@/components/onboarding/FocusedHeader";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { triggerResetPasswordOtp } from "@/services/auth.service";
import { EMAIL_REGEX } from "@/lib/validation";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

interface ForgotPasswordForm {
  email: string;
}

/**
 * Step 1 of the standalone password-reset flow ("Request"). Shared across every
 * portal: `basePath` is the originating sign-in page (for the back links), and is
 * threaded onward to the verify step via the `from` query param so the rest of the
 * flow returns to the right portal.
 */
export function ForgotPasswordScreen({ basePath = "/login" }: { basePath?: string }) {
  const router = useRouter();
  const { setData } = useOnboarding();

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ defaultValues: { email: "" } });

  const onSubmit = async (values: ForgotPasswordForm) => {
    try {
      const res = await triggerResetPasswordOtp({ email: values.email });
      // Carry the email to the verify + reset steps (masked for display there).
      setData({ resetEmail: values.email });
      toast.success(res.message ?? SUCCESS_MESSAGES.RESET_PASSWORD_OTP_SENT);
      router.push(`/reset-password/verify-otp?from=${encodeURIComponent(basePath)}`);
    } catch (err) {
      toast.error((err as ApiError).message ?? ERROR_MESSAGES.RESET_PASSWORD_FAILED);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
      <Card padding="lg" className="flex w-full max-w-[480px] flex-col gap-6 !p-6 sm:!p-8">
        <FocusedHeader backLabel="Back to sign in" backHref={basePath} />

        <div className="flex flex-col gap-1">
          <h2 className="font-headline text-2xl font-bold text-on-surface">Forgot password?</h2>
          <p className="text-sm text-on-surface-variant">
            Enter the email tied to your account and we&apos;ll send a one-time code (OTP) to
            verify it&apos;s you.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Official Email Address"
            required
            placeholder="john@example.com"
            error={errors.email?.message}
            adornment={<Icon name="mail" size={20} />}
            {...field("email", {
              required: "Email is required.",
              pattern: { value: EMAIL_REGEX, message: "Enter a valid email address." },
            })}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="cta-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader size={18} /> : "Send OTP"}
          </button>

          <p className="text-center text-sm text-on-surface-variant">
            Remembered it?{" "}
            <Link
              href={basePath}
              className="font-bold text-primary border-b border-transparent hover:border-current transition-colors"
            >
              Back to sign in
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
