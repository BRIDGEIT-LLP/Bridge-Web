"use client";

import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { DocumentUploadCard, type ScannedDoc } from "@/components/onboarding/DocumentUploadCard";
import { DOC_TYPE, DOC_MAX_MB } from "@/config/docTypes";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/common/loader";
import { Input } from "@/components/ui/input";
import { FocusedHeader } from "@/components/onboarding/FocusedHeader";
import { saveKycInfo } from "@/services/kyc.service";
import { PAN_REGEX, AADHAAR_REGEX } from "@/lib/validation";
import type { KycDocFile } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

/** Map a scanned slot to the save-kyc-info file shape (s3 key + file metadata). */
const toKycFile = (doc: ScannedDoc): KycDocFile => ({
  s3_key: doc.s3Key,
  mimetype: doc.mimetype,
  file_name: doc.fileName,
  file_size: doc.fileSize,
});

/** react-hook-form shape: one record of slot→scanned doc (file + s3Key) per card. */
interface DocumentUploadForm {
  aadhaar: Record<string, ScannedDoc>;
  pan: Record<string, ScannedDoc>;
  aadhaarNumber: string;
  panNumber: string;
}

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="px-1 text-xs font-medium text-error">{msg}</span>;
}

export default function DocumentUploadPage() {
  const { setData, goNext } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<DocumentUploadForm>({
    mode: "onChange",
    defaultValues: { aadhaar: {}, pan: {}, aadhaarNumber: "", panNumber: "" },
  });

  const onSubmit = async (values: DocumentUploadForm) => {
    setSubmitting(true);
    try {
      // Shape matches the save-kyc-info API: per-document number + per-side file objects.
      const res = await saveKycInfo({
        AADHAAR: {
          number: values.aadhaarNumber,
          front: toKycFile(values.aadhaar.front),
          back: toKycFile(values.aadhaar.back),
        },
        PAN: {
          number: values.panNumber.toUpperCase(),
          front: toKycFile(values.pan.pan),
        },
      });
      toast.success(res.message ?? "Documents submitted for verification.");

      setData({
        aadhaarNumber: values.aadhaarNumber,
        panNumber: values.panNumber,
        // S3 keys from the scan API — kept in onboarding state for reference.
        aadhaarFrontKey: values.aadhaar?.front?.s3Key,
        aadhaarBackKey: values.aadhaar?.back?.s3Key,
        panKey: values.pan?.pan?.s3Key,
      });
      goNext("kycdoc");
    } catch (err) {
      toast.error((err as ApiError)?.message ?? "Couldn't submit your documents. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Live values to gate the submit button: all files + valid numbers required.
  const [aadhaar, pan, aadhaarNumber, panNumber] = useWatch({
    control,
    name: ["aadhaar", "pan", "aadhaarNumber", "panNumber"],
  });
  const allProvided =
    !!aadhaar?.front &&
    !!aadhaar?.back &&
    !!pan?.pan &&
    AADHAAR_REGEX.test(aadhaarNumber ?? "") &&
    PAN_REGEX.test((panNumber ?? "").toUpperCase());

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-white/40 bg-surface-container-lowest p-4 ambient-shadow sm:p-6 lg:gap-3 lg:p-8">
      <FocusedHeader backHref="/registration/complete-profile" showLogout />
      <div>
        <h2 className="font-headline text-xl font-extrabold tracking-tight text-on-surface sm:text-2xl">Document Upload</h2>
        <p className="mt-1 flex items-start gap-2 text-xs text-on-surface-variant sm:text-sm">
          <Icon name="verified" size={16} filled className="mt-0.5 shrink-0 text-primary" />
          Government issued ID required for secure verification
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            id="aadhaarNumber"
            type="text"
            label="Aadhaar Number"
            required
            inputMode="numeric"
            maxLength={12}
            placeholder="1234 5678 9012"
            error={errors.aadhaarNumber?.message}
            adornment={<Icon name="badge" size={20} />}
            adornmentClassName="text-primary opacity-0 transition-opacity group-focus-within:opacity-100"
            {...register("aadhaarNumber", {
              required: "Aadhaar number is required.",
              pattern: { value: AADHAAR_REGEX, message: "Enter a valid 12-digit Aadhaar number." },
            })}
          />
          <Input
            id="panNumber"
            type="text"
            label="PAN Number"
            required
            maxLength={10}
            placeholder="ABCDE1234F"
            className="uppercase"
            error={errors.panNumber?.message}
            adornment={<Icon name="credit_card" size={20} />}
            adornmentClassName="text-primary opacity-0 transition-opacity group-focus-within:opacity-100"
            {...register("panNumber", {
              required: "PAN number is required.",
              validate: (v) => PAN_REGEX.test(v.toUpperCase()) || "Enter a valid PAN (e.g. ABCDE1234F).",
            })}
          />
        </div>

        <Controller
          control={control}
          name="aadhaar"
          rules={{
            validate: (v) =>
              (!!v?.front && !!v?.back) || "Upload both the front and back of your Aadhaar card.",
          }}
          render={({ field }) => (
            <DocumentUploadCard
              title="Aadhaar Card"
              subtitle="Front and back view required"
              icon="badge"
              scanType="image"
              docType={DOC_TYPE.AADHAAR}
              slots={[
                { key: "front", label: "Front Side", side: "front" },
                { key: "back", label: "Back Side", side: "back" },
              ]}
              maxSizeMB={DOC_MAX_MB.AADHAAR}
              onChange={field.onChange}
            />
          )}
        />
        {isSubmitted && <ErrorText msg={errors.aadhaar?.message as string | undefined} />}

        <Controller
          control={control}
          name="pan"
          rules={{ validate: (v) => !!v?.pan || "Upload a clear photo of your PAN card." }}
          render={({ field }) => (
            <DocumentUploadCard
              title="PAN Card"
              subtitle="Clear photo of the original card"
              icon="credit_card"
              scanType="image"
              docType={DOC_TYPE.PAN}
              slots={[{ key: "pan", label: "PAN Card" }]}
              maxSizeMB={DOC_MAX_MB.PAN}
              onChange={field.onChange}
              hint="Ensure all details including Name, DOB and PAN Number are clearly visible. Avoid glare from lights."
            />
          )}
        />
        {isSubmitted && <ErrorText msg={errors.pan?.message as string | undefined} />}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={!allProvided || submitting}
            className="h-12 rounded-xl max-sm:px-4 max-sm:text-sm"
            trailingIcon={submitting ? undefined : "chevron_right"}
          >
            {submitting ? <Loader size={18} /> : "Submit for Verification"}
          </Button>
        </div>
      </form>
      </div>
    </main>
  );
}
