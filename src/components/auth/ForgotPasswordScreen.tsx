"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Loader } from "@/components/common/loader";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { triggerResetPasswordOtp } from "@/services/auth.service";
import { EMAIL_REGEX } from "@/lib/validation";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";

interface ForgotPasswordForm {
  email: string;
}

/**
 * Step 1 of the standalone password-reset flow ("Reset your password" in the design prototype). Same card as the
 * member sign-in; the only difference from the prototype is that a one-time code is emailed instead of a link.
 * Shared across every portal: `basePath` is the originating sign-in page (for the back links), and is threaded
 * onward to the verify step via the `from` query param so the rest of the flow returns to the right portal.
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
    <div className="min-h-full bg-[#F6F8FA] px-4 py-8 sm:px-6 sm:py-10">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mx-auto flex w-full max-w-[470px] flex-col gap-[18px] rounded-[14px] border border-[#E3E8EE] bg-white p-[22px_18px] shadow-[0_10px_30px_rgba(26,31,43,.08)] sm:rounded-2xl sm:p-8"
      >
        <Link
          href={basePath}
          className="inline-flex items-center gap-1.5 self-start py-0.5 text-[13px] font-semibold text-[#1A1F2B] hover:text-[#0C56D0]"
        >
          <Icon name="chevron_left" size={14} />
          Back
        </Link>

        <div>
          <h2 className="font-headline text-[22px] font-bold tracking-[-0.01em] text-[#1A1F2B]">Reset your password</h2>
          <p className="mt-1 text-[13px] text-[#5B6472]">Enter the email you applied with. We’ll send you a code.</p>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="email" className="text-[12.5px] font-semibold text-[#1A1F2B]">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="name@company.com"
            className={`min-h-[42px] w-full rounded-lg border bg-white px-3 py-2.5 text-sm leading-[1.4] text-[#1A1F2B] transition-[border-color,box-shadow] placeholder:text-[#8A93A0] hover:border-[#B4BDC9] focus:border-[#0C56D0] focus:outline-none focus:ring-[3px] focus:ring-[#EAF1FC] ${
              errors.email ? "border-[#9F403D]" : "border-[#CFD6DF]"
            }`}
            {...field("email", {
              required: "Enter an email like name@company.com",
              pattern: { value: EMAIL_REGEX, message: "Enter an email like name@company.com" },
            })}
          />
          {errors.email && <p className="text-xs text-[#9F403D]">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#0C56D0] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0A49B0] active:bg-[#083C92] disabled:cursor-not-allowed disabled:bg-[#A8BFE8]"
        >
          {isSubmitting ? <Loader size={18} /> : "Send code"}
        </button>
      </form>
    </div>
  );
}
