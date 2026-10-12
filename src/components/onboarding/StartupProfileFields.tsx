"use client";

import React from "react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FileUploadField } from "@/components/onboarding/FileUploadField";
import { DOC_TYPE, DOC_MAX_MB } from "@/config/docTypes";
import {
  INDUSTRY_SECTORS,
  FUNDING_STAGES,
  TEAM_SIZE_RANGES,
  CURRENCIES,
  INTENT_OPTIONS,
  BUSINESS_DESCRIPTION_MAX_WORDS,
  PITCH_DECK_ACCEPT,
  LINKEDIN_URL_PATTERN,
  URL_REGEX,
} from "@/lib/startup-profile-options";
import type { InvestorValues } from "@/components/onboarding/InvestorProfileFields";
import type { B2BValues } from "@/components/onboarding/B2BProfileFields";

export interface Founder {
  name: string;
  url: string;
}

/**
 * Coerce GET /users/profile's `founders` value into `{ name, url }[]`.
 * The column is jsonb, so the API usually returns a real array of objects — but a
 * JSON string, `null`, or leftover empty placeholder rows must not blank the UI.
 */
export function parseFounders(value: unknown): Founder[] {
  let raw: unknown = value;
  if (typeof raw === "string" && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const rec = row && typeof row === "object" ? (row as { name?: unknown; url?: unknown }) : {};
      return { name: String(rec.name ?? "").trim(), url: String(rec.url ?? "").trim() };
    })
    .filter((f) => f.name.length > 0 || f.url.length > 0);
}

export const EMPTY_FOUNDER: Founder = { name: "", url: "" };

/** Repeatable Founders & LinkedIn rows → `{ name, url }[]` for the jsonb column. */
export function normalizeFounders(rows: Founder[] | undefined): Founder[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const rec = row && typeof row === "object" ? (row as { name?: unknown; url?: unknown }) : {};
      return { name: String(rec.name ?? "").trim(), url: String(rec.url ?? "").trim() };
    })
    .filter((f) => f.name.length > 0 && f.url.length > 0);
}

/**
 * Controlled name + LinkedIn URL rows. Used on the switch-role form — registration
 * keeps its own react-hook-form Controllers so complete-profile submit is unchanged.
 */
export function FoundersEditor({
  label = "Founders & LinkedIn",
  required = false,
  value,
  onChange,
  error,
  rowErrors,
}: {
  label?: string;
  required?: boolean;
  value: Founder[];
  onChange: (next: Founder[]) => void;
  error?: string;
  rowErrors?: { name?: string; url?: string }[];
}) {
  const rows = value.length > 0 ? value : [EMPTY_FOUNDER];

  const updateRow = (i: number, patch: Partial<Founder>) => {
    onChange(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
        {label}
        {required ? (
          <span className="align-middle text-base leading-none text-error"> *</span>
        ) : null}
      </span>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input
            id={`switch-founder-name-${i}`}
            label="Founder name"
            required={required}
            placeholder="Founder name"
            error={rowErrors?.[i]?.name}
            value={row.name}
            onChange={(e) => updateRow(i, { name: e.target.value })}
          />
          <Input
            id={`switch-founder-url-${i}`}
            label="LinkedIn URL"
            required={required}
            type="url"
            placeholder="https://linkedin.com/in/…"
            error={rowErrors?.[i]?.url}
            value={row.url}
            onChange={(e) => updateRow(i, { url: e.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            disabled={rows.length === 1}
            aria-label="Remove founder"
            className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-on-surface-variant transition-colors hover:text-error disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-auto"
          >
            <Icon name="delete" size={20} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { ...EMPTY_FOUNDER }])}
        className="-mt-1.5 flex w-fit items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-primary transition-colors hover:opacity-80"
      >
        <Icon name="add" size={18} /> Add founder
      </button>
      {error ? <span className="px-1 text-xs font-medium text-error">{error}</span> : null}
    </div>
  );
}

/** Read-only name + LinkedIn URL list used on My Profile and the public profile. */
export function FoundersList({ founders }: { founders: Founder[] }) {
  if (founders.length === 0) {
    return <span className="text-sm text-outline-variant">—</span>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {founders.map((f, i) => (
        <div key={`${f.name || "founder"}-${i}`} className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium text-on-surface">{f.name || "—"}</span>
          {f.url ? (
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1 break-all text-primary hover:underline"
            >
              <Icon name="link" size={14} className="mt-0.5 shrink-0" />
              {f.url}
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** All startup profile field values (everything here is JSON-serializable). */
export interface StartupValues {
  industrySectors: string[];
  fundingStage: string;
  fundingCurrency: string;
  fundingMin: string;
  fundingMax: string;
  useOfFunds: string;
  teamSize: string;
  founders: Founder[];
  businessDescription: string;
  websiteUrl: string;
  linkedinUrl: string;
  intent: string;
  /** S3 keys returned by the scan API once each document is uploaded. */
  incorporationCert: string;
  pitchDeck: string;
}

/** Full react-hook-form shape for the complete-profile page. */
export interface CompleteProfileForm {
  firstName: string;
  lastName: string;
  bio: string;
  country: string;
  continent: string;
  /** Primary Sector — base field shown for every role (multi-select). */
  primarySectors: string[];
  /** Account fields captured at registration — company/role/email stay locked. */
  legalName: string;
  email: string;
  /** Dial code, e.g. "+91" — same widget as company registration; sent as `country_code`. */
  countryCode: string;
  contact: string;
  role: string;
  gstNumber: string;
  cinNumber: string;
  /** Profile photo file name (the object-URL preview is kept in component state). */
  photo: string;
  /** Optional intro video — the stored s3 key ("" when none). */
  introVideo: string;
  startup: StartupValues;
  investor: InvestorValues;
  b2b: B2BValues;
}

export const defaultStartupValues: StartupValues = {
  industrySectors: [],
  fundingStage: "",
  fundingCurrency: "INR",
  fundingMin: "",
  fundingMax: "",
  useOfFunds: "",
  teamSize: "",
  founders: [{ name: "", url: "" }],
  businessDescription: "",
  websiteUrl: "",
  linkedinUrl: "",
  intent: "",
  incorporationCert: "",
  pitchDeck: "",
};

/** Word count for the business description (whitespace-delimited). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Truncate `text` to at most `max` whitespace-delimited words. */
export function truncateToWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return text;
  return words.slice(0, max).join(" ");
}

/**
 * Builds a textarea `onChange` that hard-caps input at `max` words: it truncates
 * the value in place (so the user cannot type/paste past the limit) and then
 * forwards the event to react-hook-form's own onChange.
 */
export function limitWords(
  max: number,
  rhfOnChange: React.ChangeEventHandler<HTMLTextAreaElement>
): React.ChangeEventHandler<HTMLTextAreaElement> {
  return (e) => {
    const capped = truncateToWords(e.target.value, max);
    if (capped !== e.target.value) e.target.value = capped;
    rhfOnChange(e);
  };
}

interface StartupProfileFieldsProps {
  control: Control<CompleteProfileForm>;
  register: UseFormRegister<CompleteProfileForm>;
  errors: FieldErrors<CompleteProfileForm>;
}

const SECTION_TITLE = "text-base font-semibold text-on-surface";

export function StartupProfileFields({ control, register, errors }: StartupProfileFieldsProps) {
  const e = errors.startup;
  const { fields, append, remove } = useFieldArray({ control, name: "startup.founders" });
  const businessDescription = useWatch({ control, name: "startup.businessDescription" });
  const descWords = wordCount(businessDescription ?? "");
  // Registered once so we can chain RHF's onChange with the hard word-cap below.
  const descReg = register("startup.businessDescription", {
    validate: (v) =>
      wordCount(v) <= BUSINESS_DESCRIPTION_MAX_WORDS ||
      `Keep the description under ${BUSINESS_DESCRIPTION_MAX_WORDS} words.`,
  });

  return (
    <div className="flex flex-col gap-6">
      <p className={SECTION_TITLE}>Startup Details</p>

      <Controller
        control={control}
        name="startup.industrySectors"
        rules={{ validate: (v) => v.length > 0 || "Select at least one industry sector." }}
        render={({ field }) => (
          <Select
            multiple
            id="industrySectors"
            label="Industry Sector"
            required
            placeholder="Select one or more sectors"
            options={INDUSTRY_SECTORS}
            value={field.value}
            onChange={field.onChange}
            error={e?.industrySectors?.message}
          />
        )}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Controller
          control={control}
          name="startup.fundingStage"
          render={({ field }) => (
            <Select
              id="fundingStage"
              label="Funding Stage"
              optional
              placeholder="Select stage"
              options={FUNDING_STAGES}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="startup.teamSize"
          render={({ field }) => (
            <Select
              id="teamSize"
              label="Team Size"
              optional
              placeholder="Select range"
              options={TEAM_SIZE_RANGES}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Funding ask: currency + min–max range */}
      <div className="flex flex-col gap-2">
        <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
          Funding Ask Amount<span className="align-middle text-base leading-none text-error"> *</span>
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_1fr]">
          <Controller
            control={control}
            name="startup.fundingCurrency"
            render={({ field }) => (
              <Select aria-label="Currency" options={CURRENCIES} value={field.value} onChange={field.onChange} />
            )}
          />
          <Input
            type="number"
            min={0}
            placeholder="Min"
            error={e?.fundingMin?.message}
            {...register("startup.fundingMin", { required: "Required." })}
          />
          <Input
            type="number"
            min={0}
            placeholder="Max"
            error={e?.fundingMax?.message}
            {...register("startup.fundingMax", {
              required: "Required.",
              validate: (v, all) =>
                Number(v) >= Number(all.startup.fundingMin) || "Max must be ≥ min.",
            })}
          />
        </div>
      </div>

      <Textarea
        id="useOfFunds"
        label="Use of Funds"
        required
        placeholder="How will the funds be used? (e.g. 40% product, 30% hiring, 30% marketing)"
        error={e?.useOfFunds?.message}
        {...register("startup.useOfFunds", { required: "Describe how the funds will be used." })}
      />

      {/* Founders + LinkedIn (repeatable) */}
      <div className="flex flex-col gap-3">
        <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
          Founders &amp; LinkedIn<span className="align-middle text-base leading-none text-error"> *</span>
        </span>
        {fields.map((row, i) => (
          <div key={row.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            {/* Controlled inputs — register() + useFieldArray was dropping name/url on submit. */}
            <Controller
              control={control}
              name={`startup.founders.${i}.name`}
              rules={{ required: "Required." }}
              render={({ field, fieldState }) => (
                <Input
                  id={`founder-name-${i}`}
                  label="Founder name"
                  required
                  placeholder="Founder name"
                  error={fieldState.error?.message}
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            <Controller
              control={control}
              name={`startup.founders.${i}.url`}
              rules={{
                required: "Required.",
                pattern: { value: new RegExp(LINKEDIN_URL_PATTERN, "i"), message: "Enter a valid LinkedIn URL." },
              }}
              render={({ field, fieldState }) => (
                <Input
                  id={`founder-url-${i}`}
                  label="LinkedIn URL"
                  required
                  type="url"
                  placeholder="https://linkedin.com/in/…"
                  error={fieldState.error?.message}
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={fields.length === 1}
              aria-label="Remove founder"
              className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-on-surface-variant transition-colors hover:text-error disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-auto"
            >
              <Icon name="delete" size={20} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => append({ name: "", url: "" })}
          className="-mt-1.5 flex w-fit items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-primary transition-colors hover:opacity-80"
        >
          <Icon name="add" size={18} /> Add founder
        </button>
      </div>

      {/* Business description with word counter */}
      <div className="flex flex-col gap-1">
        <Textarea
          id="businessDescription"
          label="Business Description"
          optional
          rows={5}
          placeholder="Describe your business, product and traction…"
          error={e?.businessDescription?.message}
          {...descReg}
          onChange={limitWords(BUSINESS_DESCRIPTION_MAX_WORDS, descReg.onChange)}
        />
        <span
          className={`px-1 text-xs font-medium ${
            descWords > BUSINESS_DESCRIPTION_MAX_WORDS ? "text-error" : "text-on-surface-variant"
          }`}
        >
          {descWords} / {BUSINESS_DESCRIPTION_MAX_WORDS} words
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Input
          type="url"
          label="Company Website"
          optional
          placeholder="https://yourcompany.com"
          error={e?.websiteUrl?.message}
          {...register("startup.websiteUrl", {
            validate: (v) => !v || URL_REGEX.test(v) || "Enter a valid URL.",
          })}
        />
        <Input
          type="url"
          label="Company LinkedIn"
          optional
          placeholder="https://linkedin.com/company/…"
          error={e?.linkedinUrl?.message}
          {...register("startup.linkedinUrl", {
            validate: (v) =>
              !v || new RegExp(LINKEDIN_URL_PATTERN, "i").test(v) || "Enter a valid LinkedIn URL.",
          })}
        />
      </div>

      <Controller
        control={control}
        name="startup.intent"
        rules={{ required: "Select your intent." }}
        render={({ field }) => (
          <Select
            id="intent"
            label="Intent"
            required
            placeholder="Select your intent"
            options={INTENT_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={e?.intent?.message}
          />
        )}
      />
      {/* document upload uncomment the this block  */}
      
      {/* Mandatory documents */}
      <div className="flex flex-col gap-4">
        <p className={SECTION_TITLE}>Documents</p>
        <Controller
          control={control}
          name="startup.incorporationCert"
          rules={{ validate: (v) => !!v || "Upload your Incorporation Certificate." }}
          render={({ field }) => (
            <FileUploadField
              id="incorporationCert"
              label="Incorporation Certificate"
              required
              hint={`PDF only (max ${DOC_MAX_MB.INCORPORATION_CERTIFICATE}MB)`}
              accept={PITCH_DECK_ACCEPT}
              maxSizeMB={DOC_MAX_MB.INCORPORATION_CERTIFICATE}
              scanType="document"
              docType={DOC_TYPE.INCORPORATION_CERTIFICATE}
              value={field.value}
              error={e?.incorporationCert?.message}
              onChange={(res) => field.onChange(res?.s3Key ?? "")}
            />
          )}
        />
        <Controller
          control={control}
          name="startup.pitchDeck"
          rules={{
            validate: (v) => !!v || `Upload your Pitch Deck (PDF, max ${DOC_MAX_MB.PITCH_DECK} MB).`,
          }}
          render={({ field }) => (
            <FileUploadField
              id="pitchDeck"
              label={`Pitch Deck (PDF, max ${DOC_MAX_MB.PITCH_DECK} MB)`}
              required
              hint={`PDF only (max ${DOC_MAX_MB.PITCH_DECK}MB)`}
              accept={PITCH_DECK_ACCEPT}
              maxSizeMB={DOC_MAX_MB.PITCH_DECK}
              scanType="document"
              docType={DOC_TYPE.PITCH_DECK}
              value={field.value}
              error={e?.pitchDeck?.message}
              onChange={(res) => field.onChange(res?.s3Key ?? "")}
            />
          )}
        />
      </div>
    </div>
  );
}
