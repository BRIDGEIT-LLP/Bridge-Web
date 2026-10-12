"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Modal } from "@/components/modal/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/Icon";
import { ROLE_META, type Role } from "@/lib/roles";
import { companyInitials } from "@/lib/explore-format";
import { getIntentOptions } from "@/lib/connection-intent-options";
import { sendConnectionRequest } from "@/services/connections.service";
import type { SenderIdentity } from "@/components/dashboard/connections/sender-identity";
import type { ApiError } from "@/lib/axios";

const MESSAGE_MAX = 300;
const FORM_ID = "proposal-form";

interface ProposalFormValues {
  intent: string[];
  message: string;
  productServiceDetails: string;
  expectedDealSize: string;
}

/** Recipient identifiers sent to the backend, plus display identity (name/role/company)
 *  shown read-only in the modal — sourced from the Explore match the request is sent from. */
export interface ProposalRecipient {
  id: string;
  roleId?: number;
  companyId?: string;
  name: string;
  company: string;
  role: Role | null;
}

interface ProposalFormModalProps {
  open: boolean;
  onClose: () => void;
  /** The RECIPIENT identifiers — used in the payload. */
  recipient: ProposalRecipient;
  /** The SENDER's prepopulated identity (from GET /users/profile). */
  sender: SenderIdentity;
  /** Fired after a successful send (e.g. advance the deck / refresh). */
  onSent?: () => void;
}

/**
 * Modal to send a structured connection request. Shows the sender's own identity
 * (name / role / company, prepopulated read-only) and collects two fields: the
 * connection intent (role-specific dropdown) and an optional ≤300-char note.
 */
export function ProposalFormModal({ open, onClose, recipient, sender, onSent }: ProposalFormModalProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProposalFormValues>({
    defaultValues: { intent: [], message: "", productServiceDetails: "", expectedDealSize: "" },
  });

  const message = useWatch({ control, name: "message" }) ?? "";
  const intent = useWatch({ control, name: "intent" }) ?? [];

  const recipientRoleMeta = recipient.role ? ROLE_META[recipient.role] : undefined;
  const options = getIntentOptions(sender.role);

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: ProposalFormValues) => {
    try {
      await sendConnectionRequest({
        recipientUserId: recipient.id,
        recipientRoleId: recipient.roleId,
        recipientCompanyId: recipient.companyId,
        personalMessage: values.message?.trim() ?? "",
        bussinessIntent: values.intent,
        expectedDealSize: values.expectedDealSize?.trim() ?? "",
        productServiceDetails: values.productServiceDetails?.trim() ?? "",
      });
      toast.success("Connection request sent.");
      onSent?.();
      close();
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't send the request. Please try again.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Send Connection Request"
      maxWidthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={close}
            className="flex h-11 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container sm:px-5 sm:text-base"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={isSubmitting || intent.length === 0}
            className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:text-base"
          >
            <Icon name="send" size={18} className="shrink-0" />
            {isSubmitting ? "Sending…" : "Send Request"}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Recipient identity — who this request is being sent TO, read-only */}
        <div className="flex items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 sm:p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-base font-black text-white sm:size-12">
            {companyInitials(recipient.name || recipient.company || "—")}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-headline text-base font-bold text-on-surface">
              {recipient.name || "—"}
            </h3>
            <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary sm:text-sm">
              {recipientRoleMeta && <Icon name={recipientRoleMeta.icon} size={15} className="shrink-0" />}
              <span className="shrink-0">{recipientRoleMeta?.label ?? "—"}</span>
              {recipient.company && (
                <span className="truncate font-normal text-on-surface-variant">· {recipient.company}</span>
              )}
            </p>
          </div>
        </div>

        {/* Intent — role-specific multiselect dropdown */}
        <Controller
          control={control}
          name="intent"
          rules={{ validate: (v) => (v && v.length > 0) || "Please select at least one connection purpose." }}
          render={({ field }) => (
            <Select
              multiple
              label="Connection Purpose / Intent"
              required
              placeholder="Select purpose(s)…"
              options={options}
              value={field.value}
              onChange={field.onChange}
              error={errors.intent?.message}
            />
          )}
        />

        {/* Product / service details — required textarea */}
        <Textarea
          label="Product / Service Details"
          required
          rows={3}
          placeholder="Describe the product or service you're proposing…"
          error={errors.productServiceDetails?.message}
          {...register("productServiceDetails", { required: "Please add product / service details." })}
        />

        {/* Expected deal size — required input */}
        <Input
          label="Expected Deal Size"
          required
          placeholder="e.g. ₹50L – ₹1Cr"
          error={errors.expectedDealSize?.message}
          {...register("expectedDealSize", { required: "Please add the expected deal size." })}
        />

        {/* Personalised message — optional, ≤300 chars */}
        <div className="flex flex-col gap-1">
          <Textarea
            label="Personalised Message"
            optional
            rows={4}
            maxLength={MESSAGE_MAX}
            placeholder="Add a short note to introduce yourself (optional)…"
            {...register("message", { maxLength: MESSAGE_MAX })}
          />
          <span
            className={`px-1 text-right text-xs font-medium ${
              message.length >= MESSAGE_MAX ? "text-error" : "text-on-surface-variant"
            }`}
          >
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
      </form>
    </Modal>
  );
}
