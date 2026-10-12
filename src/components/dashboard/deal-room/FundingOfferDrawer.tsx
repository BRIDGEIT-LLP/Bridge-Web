"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CURRENCIES } from "@/lib/startup-profile-options";
import { todayLocalDateStr } from "@/lib/utils";
import type { DealFundingOffer, FundingOfferFormValues, ValuationType } from "./types";

const NOTES_MAX = 500;

const VALUATION_OPTIONS = [
  { value: "Pre-money", label: "Pre-money" },
  { value: "Post-money", label: "Post-money" },
];

interface FundingOfferDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "counter";
  /** Target Founder/Startup Name — read-only, pre-populated from the active connection. */
  counterpartyName: string;
  /** Only used in counter mode, to pre-fill the form with the offer being countered. */
  sourceOffer?: DealFundingOffer | null;
  /** Called on submit; the caller (DealSidePanel) turns this into the socket emit. */
  onConfirm: (values: FundingOfferFormValues) => Promise<void> | void;
}

const emptyValues: FundingOfferFormValues = {
  amount: "",
  currency: "INR",
  equityPercent: "",
  valuationType: "",
  validUntil: "",
  terms: "",
  notes: "",
};

function valuesFromOffer(offer: DealFundingOffer): FundingOfferFormValues {
  return {
    amount: String(offer.amount),
    currency: offer.currency,
    equityPercent: String(offer.equityPercent),
    valuationType: offer.valuationType,
    validUntil: offer.validUntil.slice(0, 10),
    terms: offer.terms ?? "",
    notes: offer.notes ?? "",
  };
}

/**
 * Right-side drawer to create a new funding offer (investor) or submit a counter
 * (founder) — same fields and validation either way, only the title text and
 * `defaultValues` differ. Purely presentational: `onConfirm` hands the values back
 * to the caller, which owns the actual socket emit (create_funding_offer, optionally
 * with a parentOfferId for a counter).
 */
export function FundingOfferDrawer({ open, onClose, mode, counterpartyName, sourceOffer, onConfirm }: FundingOfferDrawerProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FundingOfferFormValues>({
    defaultValues: mode === "counter" && sourceOffer ? valuesFromOffer(sourceOffer) : emptyValues,
  });

  const notes = useWatch({ control, name: "notes" }) ?? "";

  const close = () => {
    reset(emptyValues);
    onClose();
  };

  const onSubmit = async (values: FundingOfferFormValues) => {
    await onConfirm(values);
    reset(emptyValues);
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={mode === "counter" ? "Submit Counter-Offer" : "New Funding Offer"}
      subtitle={mode === "counter" ? "Send a revised offer back" : "Stage 2: Negotiation"}
      widthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={close}
            className="flex h-11 items-center rounded-xl border border-dashed border-outline-variant/60 px-5 font-bold max-sm:px-3 max-sm:text-sm text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="funding-offer-form"
            disabled={isSubmitting}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-6 font-bold max-sm:px-3 max-sm:text-sm text-on-primary transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="send" size={18} />
            {isSubmitting ? "Sending…" : "Send Offer"}
          </button>
        </>
      }
    >
      <form id="funding-offer-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Input label="Target Founder / Startup Name" value={counterpartyName} disabled />

        {/* Investment Amount: currency + numeric value */}
        <div className="flex flex-col gap-2">
          <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
            Investment Amount<span className="align-middle text-base leading-none text-error"> *</span>
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select aria-label="Currency" options={CURRENCIES} value={field.value} onChange={field.onChange} searchable={false} />
              )}
            />
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Amount"
              error={errors.amount?.message}
              {...register("amount", {
                required: "Investment amount is required.",
                validate: (v) => Number(v) > 0 || "Enter an amount greater than 0.",
              })}
            />
          </div>
        </div>

        <Input
          label="Equity Percentage"
          required
          type="number"
          min={0}
          max={100}
          step="any"
          adornment="%"
          placeholder="e.g. 12.5"
          error={errors.equityPercent?.message}
          {...register("equityPercent", {
            required: "Equity percentage is required.",
            validate: (v) => (Number(v) > 0 && Number(v) < 100) || "Enter a value between 0 and 100 (exclusive).",
          })}
        />

        <Controller
          control={control}
          name="valuationType"
          rules={{ required: "Please select a valuation type." }}
          render={({ field }) => (
            <Select
              label="Company Valuation"
              required
              placeholder="Pre-money or Post-money…"
              options={VALUATION_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v as ValuationType)}
              searchable={false}
              error={errors.valuationType?.message}
            />
          )}
        />

        <Input
          label="Offer Validity Period"
          required
          type="date"
          min={todayLocalDateStr()}
          error={errors.validUntil?.message}
          {...register("validUntil", {
            required: "Please pick a validity date.",
            validate: (v) => (!!v && v > todayLocalDateStr()) || "Validity date must be in the future.",
          })}
        />

        <Textarea
          label="Terms & Conditions / Key Conditions"
          optional
          rows={4}
          placeholder="Outline any baseline legal clauses or prerequisites…"
          {...register("terms")}
        />

        <div className="flex flex-col gap-1">
          <Textarea
            label="Supporting Notes"
            optional
            rows={3}
            maxLength={NOTES_MAX}
            placeholder="Add personal context or a brief message (optional)…"
            {...register("notes", { maxLength: NOTES_MAX })}
          />
          <span
            className={`px-1 text-right text-xs font-medium ${
              notes.length >= NOTES_MAX ? "text-error" : "text-on-surface-variant"
            }`}
          >
            {notes.length}/{NOTES_MAX}
          </span>
        </div>
      </form>
    </Drawer>
  );
}
