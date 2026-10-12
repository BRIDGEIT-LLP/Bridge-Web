"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Input, FIELD_STYLES } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Loader } from "@/components/common/loader";
import { getUserProfile, saveUserProfile, type ProfileField } from "@/services/user.service";
import { FoundersList, parseFounders, type Founder } from "@/components/onboarding/StartupProfileFields";
import {
  getFieldOptionConfig,
  TEXTAREA_COLUMNS,
  NUMBER_COLUMNS,
  FUNDING_CURRENCY_COL,
  FUNDING_MIN_COL,
  FUNDING_MAX_COL,
  TICKET_CURRENCY_COL,
  TICKET_MIN_COL,
  TICKET_MAX_COL,
} from "@/lib/profile-field-options";
import { CURRENCIES } from "@/lib/startup-profile-options";
import { DIAL_CODES, continentForCountry } from "@/lib/countries";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { VideoUploadField } from "@/components/onboarding/VideoUploadField";
import { profilePhotoKey } from "@/lib/useMyProfilePhoto";
import { scanDocument, scanImage } from "@/services/file.service";
import { DOC_TYPE, DOC_MAX_MB, type DocType } from "@/config/docTypes";
import type { ApiError } from "@/lib/axios";
import { getAdminProfile, saveAdminProfile } from "@/services/admin.service";
import { useAuth } from "@/components/auth/AuthProvider";
import { isStaffRole } from "@/lib/roles";
import { phoneErrorForDialCode, nationalDigits } from "@/lib/validation";

/**
 * Columns that hold an uploaded document's S3 key (rendered with a Preview button, and
 * a Replace/Upload control in edit mode). The value is the `docType` the scan API files
 * the upload under.
 */
const DOCUMENT_COLUMNS = new Map<string, DocType>([
  ["incorporation_certificate", DOC_TYPE.INCORPORATION_CERTIFICATE],
  ["pitch_deck_certificate", DOC_TYPE.PITCH_DECK],
]);

/** Matches the backend's `fileUpload` multer config: PDF only (size limits: `DOC_MAX_MB`). */
const DOCUMENT_ACCEPT = "application/pdf";

/** Profile columns handled by the combined phone widget (rendered together). */
const PHONE_NUMBER_COL = "mobile_number";
const PHONE_CODE_COL = "country_code";

/**
 * The `user` column holding the profile-picture storage key. Rendered as a real
 * avatar + upload control (`PhotoField`), never as the generic text input its API
 * `type: "string"` would otherwise produce.
 */
const PHOTO_COL = "profile_photo";
const INTRO_VIDEO_COL = "intro_video";
/** Matches the registration complete-profile photo picker. */
const PHOTO_MIME_TYPES = ["image/png", "image/jpeg"];

/** The startup `founders` jsonb column — [{ name, url }], not a list of option codes. */
const FOUNDERS_COL = "founders";

/**
 * Field grouping + order, mirroring the registration complete-profile flow so the
 * profile reads the same way. Each section lists its columns in display order;
 * only the columns the API actually returns are shown (so role-specific sections
 * appear only for that role). Columns not listed anywhere fall into a trailing
 * "Additional Information" section. Folded columns (`country_code`,
 * `funding_currency`, `funding_ask_amt_max`, `ticket_currency`,
 * `ticket_size_amt_max`) are intentionally omitted — they're rendered inside
 * the phone / amount widgets at their anchor column.
 *
 * Every column `user_profile_field_master` configures must appear here (or be folded
 * into a widget), otherwise it only shows up under "Additional Information". The
 * read-only public profile (`profile/[userId]`) reuses this list, and hides
 * `profile_photo` itself — it shows the picture as its header avatar instead.
 */
export const PROFILE_SECTIONS: { title: string; columns: string[] }[] = [
  {
    title: "Account Details",
    columns: ["organization_name", "role", "company_email", "mobile_number", "gst_number", "cin_number"],
  },
  {
    title: "Personal Info",
    columns: ["profile_photo", "first_name", "last_name", "country", "continent"],
  },
  {
    title: "Primary Sector",
    columns: ["primary_sector"],
  },
  {
    title: "Startup Details",
    columns: [
      "startup_industry_sector",
      "funding_stage",
      "team_size_min",
      "team_size_max",
      "funding_ask_amt_min",
      "use_of_funds",
      "business_description",
      "startup_intent",
      "founders",
      "incorporation_certificate",
      "pitch_deck_certificate",
    ],
  },
  {
    title: "Investment Profile",
    columns: [
      "investor_sector_preference",
      "prefrerred_investment_stage",
      "stage_focus",
      "ticket_size_amt_min",
      "geographic_investment_preference",
      "geographic_investment_preference_continent",
      "investor_type",
      "investor_intent",
      "investment_thesis",
      "investor_portfolio_overview",
      "number_of_investments_to_date",
    ],
  },
  {
    title: "Business Profile",
    columns: [
      "b2b_sector",
      "b2b_sub_sector",
      "industry_vertical",
      "business_type",
      "min_order_quantity",
      "revenue_band",
      "years_in_operation",
      "b2b_geography_country",
      "b2b_geography_continent",
      "export_rediness",
      "b2b_intent",
      "products_ervice_Offered",
      "business_requirements",
      "operational_capacity_description",
    ],
  },
  {
    title: "Links",
    columns: ["company_website_url", "linkedin_profile_url"],
  },
  {
    title: "About",
    columns: ["short_bio", "address", "intro_video"],
  },
];

/**
 * Field grouping for ADMIN / SUPER_ADMIN self-service profiles.
 * Simpler shape — only the admin's own account fields are shown.
 * `country_code` is intentionally omitted here (folded into the phone widget
 * at the `mobile_number` anchor, same as user profiles).
 */
const ADMIN_PROFILE_SECTIONS: { title: string; columns: string[] }[] = [
  {
    title: "Account Details",
    columns: ["name", "email", "role", "mobile_number"],
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

/** API field values plus the local string/string[] working copies. */
type CoercibleValue = ProfileField["value"] | string[] | null | undefined;

/** Keep only string entries — founders is `[{ name, url }, …]`, not option codes. */
function stringEntries(value: unknown[]): string[] {
  return value.filter((v): v is string => typeof v === "string");
}

/** Coerce any stored value into a string[] (parses JSON / comma-joined strings). */
function toArrayValue(value: CoercibleValue): string[] {
  // `founders` is an array of {name, url} objects, not option codes. Every consumer of
  // this helper renders entries as text/chips, and a non-string child throws — so drop
  // anything that isn't a string. The profile page renders founders from `field.value`
  // directly (see FoundersField), so nothing is lost here.
  if (Array.isArray(value)) return stringEntries(value);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return stringEntries(parsed);
    } catch { /* noop */ }
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Coerce any stored value into a single string (joins arrays for display).
 *
 * The `String()` is load-bearing: numeric columns come back from the API as real
 * JSON numbers, and every control below renders `typeof value === "string" ? value : ""`
 * — so without coercing here, Ticket Size, Number of Investments, Years in Operation,
 * MOQ, Team Size and the funding amounts all render blank.
 */
function toStringValue(value: CoercibleValue): string {
  if (value === null || value === undefined) return "";
  return Array.isArray(value) ? stringEntries(value).join(", ") : String(value);
}

/**
 * Normalize a field's API value into the shape the UI control expects. A field is
 * multi-select when its API `type` is "array" OR the registration registry says
 * so (so the choice list stays in sync with the registration flow).
 *
 * Exported so other read-only views (e.g. the navbar-search profile page) can
 * reuse the exact same field rendering as My Profile.
 */
export function normalizeValue(field: ProfileField): string | string[] {
  const cfg = getFieldOptionConfig(field.columnName);
  const isMulti = field.type === "array" || cfg?.multiple === true;
  return isMulti ? toArrayValue(field.value) : toStringValue(field.value);
}

/** "" / non-numeric → undefined; otherwise the parsed number. */
function toNumber(v: string): number | undefined {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Value-equality for field values (order-insensitive for multi-select arrays). */
function valuesEqual(a: string | string[], b: string | string[]): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = [...toArrayValue(a)].sort();
    const y = [...toArrayValue(b)].sort();
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  return toStringValue(a) === toStringValue(b);
}

/**
 * Build the PUT-profile payload with ONLY the columns the user actually changed
 * (current value differs from the fetched value). Keys are the backend `user`
 * columns (the API's own `columnName`s) — the same snake_case keys registration
 * sends. Numeric columns are coerced to numbers; a changed-but-blank number is
 * skipped (can't be sent as a number).
 */
function buildPayload(
  fields: ProfileField[],
  localValues: Record<string, string | string[]>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const col = f.columnName;
    const original = normalizeValue(f);
    const current = localValues[col] ?? original;

    // Send only changed columns.
    if (valuesEqual(current, original)) continue;

    if (NUMBER_COLUMNS.has(col)) {
      const n = typeof current === "string" ? toNumber(current) : undefined;
      if (n === undefined) continue; // changed to blank/invalid → can't send as a number
      out[col] = n;
    } else if (col === PHONE_NUMBER_COL && typeof current === "string") {
      out[col] = nationalDigits(current);
    } else {
      // Strings/arrays sent as-is — including an intentional clear ("" / []).
      out[col] = current;
    }
  }
  return out;
}

/**
 * Client-side checks run before the save request. Keyed by column so the message
 * can be handed to that field's control, following the project's `errors` state
 * convention. The mobile number is checked against the selected dial code (same
 * rules as registration / complete-profile), so a profile can never be edited into
 * a number that sign-up would have rejected. Locked (non-editable) columns are
 * skipped — the user can't have caused a problem there.
 */
function validateFields(
  fields: ProfileField[],
  localValues: Record<string, string | string[]>,
): Record<string, string> {
  const found: Record<string, string> = {};

  const phone = fields.find((f) => f.columnName === PHONE_NUMBER_COL);
  if (phone?.isEditable) {
    const value = toStringValue(localValues[PHONE_NUMBER_COL] ?? normalizeValue(phone)).trim();
    const code = toStringValue(localValues[PHONE_CODE_COL] ?? "").trim() || "+91";
    const err = phoneErrorForDialCode(code, value);
    if (err) found[PHONE_NUMBER_COL] = err;
  }

  return found;
}

// ─── individual field ─────────────────────────────────────────────────────────

interface FieldProps {
  field: ProfileField;
  value: string | string[];
  editMode: boolean;
  onChange: (col: string, val: string | string[]) => void;
  /** Inline validation message — red-rings the control, same as registration. */
  error?: string;
}

/** Shared label row (with optional lock icon) for the select-style fields. */
function FieldLabel({
  id,
  label,
  locked,
  required,
  optional,
}: {
  id: string;
  label: string;
  locked: boolean;
  /** Same red `*` the registration complete-profile fields use. */
  required?: boolean;
  /** Same blue "(Optional)" the registration complete-profile fields use. */
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={id}
        className="px-1 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant"
      >
        {label}
        {required ? (
          <span className="align-middle text-base leading-none text-error"> *</span>
        ) : null}
        {optional ? (
          <span className="font-medium normal-case text-primary"> (Optional)</span>
        ) : null}
      </label>
      {locked && <Icon name="lock" size={13} className="text-outline-variant" />}
    </div>
  );
}

/**
 * Combined Country-Code + Mobile-Number control — mirrors the company
 * registration "Contact Number" widget (dial-code Select + tel input in one
 * bordered row). Used in place of two separate `country_code` / `mobile_number`
 * fields so My Profile matches the registration UI.
 */
function PhoneField({
  label,
  codeValue,
  numberValue,
  disabled,
  locked,
  error,
  onCodeChange,
  onNumberChange,
}: {
  label: string;
  codeValue: string;
  numberValue: string;
  disabled: boolean;
  locked: boolean;
  /** Validation message shown below the row (and red-rings it) while editing. */
  error?: string;
  onCodeChange: (val: string) => void;
  onNumberChange: (val: string) => void;
}) {
  if (disabled) {
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel id="profile-field-mobile_number" label={label} locked={locked} />
        <div className="flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2 text-sm text-on-surface">
          {numberValue ? (
            <>
              <span className="font-medium text-on-surface-variant">{codeValue || "+91"}</span>
              <span>{numberValue}</span>
            </>
          ) : (
            <span className="text-outline-variant">—</span>
          )}
          <Icon name="smartphone" size={16} className="ml-auto text-on-surface-variant" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id="profile-field-mobile_number" label={label} locked={locked} />
      <div
        className={`relative flex h-10 w-full min-w-0 items-center rounded-lg border bg-surface-container-low transition-all duration-200 focus-within:border-primary focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/10 ${
          error ? FIELD_STYLES.filled.error : "border-outline-variant/30"
        }`}
      >
        <div className="w-[4.4rem] shrink-0 sm:w-[4.8rem]">
          <Select
            aria-label="Country code"
            searchable
            placeholder="Code"
            options={DIAL_CODES}
            value={codeValue || "+91"}
            onChange={onCodeChange}
            className="flex h-10 w-full cursor-pointer items-center justify-between gap-1 bg-transparent px-2.5 text-left text-sm text-on-surface outline-none hover:opacity-85 sm:px-3"
            panelClassName="w-64 max-w-[calc(100vw-2.5rem)] sm:w-80"
            displayValueOnly
          />
        </div>
        <div className="h-5 w-px shrink-0 bg-outline-variant/30" />
        <input
          id="profile-field-mobile_number"
          type="tel"
          placeholder="9632585698"
          value={numberValue}
          onChange={(e) => onNumberChange(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-on-surface outline-none placeholder:text-outline-variant sm:px-3"
        />
        <div className="flex shrink-0 items-center pr-2.5 text-on-surface-variant sm:pr-3">
          <Icon name="smartphone" size={18} />
        </div>
      </div>
      {error && <span className="px-1 text-xs font-medium text-error">{error}</span>}
    </div>
  );
}

/**
 * Founders & LinkedIn — the one `array` column whose entries are objects, not option
 * codes, so the chip renderer below would try to render `{name, url}` as a React child
 * and throw. Read-only here: repeatable rows are added/removed in the registration
 * complete-profile step, and this page has no repeatable-row editor.
 */
function FoundersField({ label, founders }: { label: string; founders: Founder[] }) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id={`profile-field-${FOUNDERS_COL}`} label={label} locked />
      <div className="flex min-h-10 flex-col gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2">
        <FoundersList founders={founders} />
      </div>
    </div>
  );
}

/**
 * Profile-photo row. The API reports `profile_photo` as a plain string (it holds a
 * storage key), so without this it would render as a text input showing a raw S3
 * path. Shows the stored picture through the shared `Avatar`, plus a Change/Upload
 * control in edit mode that runs the same scan+upload pipeline registration uses.
 * The returned key lands in `localValues` and is saved with everything else, so a
 * discarded edit never repoints the profile at the new file.
 */
export function PhotoField({
  label,
  photoKey,
  locked,
  editable,
  required,
  optional,
  onUploaded,
}: {
  label: string;
  photoKey: string;
  locked: boolean;
  /** Edit mode is on AND this field is editable — only then is upload offered. */
  editable: boolean;
  required?: boolean;
  optional?: boolean;
  onUploaded: (s3Key: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  // Instant local preview of a just-picked file; the stored key needs a round trip.
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear immediately so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (!PHOTO_MIME_TYPES.includes(file.type)) {
      toast.error("Profile photo must be a PNG or JPEG image.");
      return;
    }
    if (file.size > DOC_MAX_MB.PROFILE_PHOTO * 1024 * 1024) {
      toast.error(`Profile photo must be ${DOC_MAX_MB.PROFILE_PHOTO}MB or smaller.`);
      return;
    }

    setUploading(true);
    try {
      const { s3Key } = await scanImage(file, { docType: DOC_TYPE.PROFILE_PHOTO });
      setPreview(URL.createObjectURL(file));
      onUploaded(s3Key);
      toast.success("Photo uploaded.");
    } catch (err) {
      toast.error((err as ApiError)?.message ?? "Couldn't upload your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const fallback = (
    <div className="flex size-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
      <Icon name="account_circle" size={36} />
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id={`profile-field-${PHOTO_COL}`} label={label} locked={locked} required={required} optional={optional} />
      <div className="flex min-h-10 items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2.5">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, not an optimizable asset
          <img src={preview} alt={label} className="size-16 shrink-0 rounded-full object-cover" />
        ) : (
          <Avatar photoKey={photoKey} alt={label} className="size-16 shrink-0 rounded-full">
            {fallback}
          </Avatar>
        )}

        <span className="min-w-0 flex-1 truncate text-sm text-on-surface-variant">
          {photoKey ? "Photo uploaded" : "No photo uploaded"}
        </span>

        {editable && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={PHOTO_MIME_TYPES.join(",")}
              onChange={handleFile}
              className="hidden"
              aria-hidden
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              aria-label={uploading ? "Uploading photo" : "Upload photo"}
              title={uploading ? "Uploading…" : photoKey ? "Change" : "Upload"}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary-container/40 disabled:opacity-60"
            >
              {uploading ? <Loader size={16} /> : <Icon name="photo_camera" size={16} />}
              <span className="hidden sm:inline">
                {uploading ? "Uploading…" : photoKey ? "Change" : "Upload"}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Currency + min + max on one row, mirroring registration (Funding Ask Amount /
 * Ticket Size). Folds the three columns into a single control.
 */
export function AmountRangeField({
  id,
  label,
  currencyValue,
  minValue,
  maxValue,
  disabled,
  locked,
  required,
  optional,
  minError,
  maxError,
  onCurrencyChange,
  onMinChange,
  onMaxChange,
}: {
  id: string;
  label: string;
  currencyValue: string;
  minValue: string;
  maxValue: string;
  disabled: boolean;
  locked: boolean;
  required?: boolean;
  optional?: boolean;
  minError?: string;
  maxError?: string;
  onCurrencyChange: (val: string) => void;
  onMinChange: (val: string) => void;
  onMaxChange: (val: string) => void;
}) {
  const currencyLabel = CURRENCIES.find((c) => c.value === currencyValue)?.label ?? currencyValue;

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id={id} label={label} locked={locked} required={required} optional={optional} />
      {disabled ? (
        <div className="flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2 text-sm text-on-surface">
          {minValue || maxValue ? (
            <>
              {currencyLabel && (
                <span className="font-medium text-on-surface-variant">{currencyLabel}</span>
              )}
              <span>{minValue || "—"} – {maxValue || "—"}</span>
            </>
          ) : (
            <span className="text-outline-variant">—</span>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_1fr]">
          <Select
            aria-label="Currency"
            options={CURRENCIES}
            value={currencyValue || "INR"}
            onChange={onCurrencyChange}
          />
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={minValue}
            error={minError}
            onChange={(e) => onMinChange(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={maxValue}
            error={maxError}
            onChange={(e) => onMaxChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Uploaded-document row — shows whether a file is present, a Preview button that opens
 * the shared `DocumentPreviewModal` for the stored S3 key, and (in edit mode, when the
 * field isn't locked) an Upload/Replace control.
 *
 * Uploading goes through the same scan endpoint the registration step uses, so the file
 * is virus-scanned and stored identically. It returns the new S3 key, which is handed to
 * `onUploaded` and lands in `localValues` — the column is then saved with the rest of the
 * form on "Save Changes", so a discarded edit never repoints the profile at the new file.
 */
function DocumentField({
  label,
  s3Key,
  locked,
  editable,
  docType,
  onPreview,
  onUploaded,
}: {
  label: string;
  s3Key: string;
  locked: boolean;
  /** Edit mode is on AND this field is editable — only then is upload offered. */
  editable: boolean;
  docType: DocType;
  onPreview: () => void;
  onUploaded: (s3Key: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear immediately so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (file.type !== DOCUMENT_ACCEPT) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    const maxMB = DOC_MAX_MB[docType];
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`File is too large — the limit is ${maxMB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const { s3Key: uploadedKey } = await scanDocument(file, { docType });
      onUploaded(uploadedKey);
      toast.success(`${label} uploaded. Click Save Changes to keep it.`);
    } catch (err) {
      toast.error((err as ApiError)?.message ?? "Couldn't upload the document. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id={`profile-field-${label}`} label={label} locked={locked} />
      <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2">
        {s3Key ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-on-surface">
            <Icon name="description" size={16} className="shrink-0 text-primary" />
            <span className="truncate">Document uploaded</span>
          </span>
        ) : (
          <span className="text-sm text-outline-variant">Not uploaded</span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {s3Key && (
            <button
              type="button"
              onClick={onPreview}
              aria-label="Preview document"
              title="Preview"
              className="flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-primary transition-colors hover:bg-primary-container/40 sm:h-auto sm:w-auto sm:rounded-lg sm:px-2.5 sm:py-1"
            >
              <Icon name="visibility" size={16} />
              <span className="hidden sm:inline">Preview</span>
            </button>
          )}

          {editable && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                onChange={handleFile}
                className="hidden"
                aria-hidden
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                aria-label={uploading ? "Uploading document" : "Upload document"}
                title={uploading ? "Uploading…" : "Upload"}
                className="flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-primary transition-colors hover:bg-primary-container/40 disabled:opacity-60 sm:h-auto sm:w-auto sm:rounded-lg sm:px-2.5 sm:py-1"
              >
                {uploading ? <Loader size={16} /> : <Icon name="upload_file" size={16} />}
                <span className="hidden sm:inline">{uploading ? "Uploading…" : "Upload"}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Exported so read-only profile views (navbar search result page) can reuse it. */
export function ProfileFieldRow({ field, value, editMode, onChange, error }: FieldProps) {
  const id = `profile-field-${field.columnName}`;
  const locked = !field.isEditable;
  const disabled = !editMode || locked;
  const required = field.isRequired === true;
  const optional = field.isRequired === false;
  const label = field.label ?? field.columnName;

  // Full registration option list for this column (Primary Sector, Country,
  // dial code, …). Falls back to the API-supplied options when not registered.
  const cfg = getFieldOptionConfig(field.columnName);
  const options = cfg?.options ?? field.options ?? [];
  const isMulti = cfg?.multiple ?? field.type === "array";

  // ── single-select dropdown (registry-backed: country, funding stage, …) ──
  if (cfg && !cfg.multiple) {
    const selected = toStringValue(value);
    const selectedLabel = options.find((o) => o.value === selected)?.label ?? selected;

    return (
      <div className="flex flex-col gap-2">
        <FieldLabel id={id} label={label} locked={locked} required={required} optional={optional} />
        {disabled ? (
          <div className="flex min-h-10 items-center rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2 text-sm text-on-surface">
            {selectedLabel || <span className="text-outline-variant">—</span>}
          </div>
        ) : (
          <Select
            id={id}
            options={options}
            value={selected}
            searchable={cfg.searchable}
            placeholder={`Select ${label.toLowerCase()}`}
            required={required}
            optional={optional}
            error={error}
            onChange={(val) => onChange(field.columnName, val)}
          />
        )}
      </div>
    );
  }

  // ── multi-select (API `type: "array"` or registry-backed multi) ──
  if (isMulti) {
    const selected = toArrayValue(value);

    return (
      <div className="flex flex-col gap-2">
        <FieldLabel id={id} label={label} locked={locked} required={required} optional={optional} />

        {disabled ? (
          /* Read-only chip display */
          <div className="flex min-h-10 flex-wrap gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2">
            {selected.length === 0 ? (
              <span className="text-sm text-outline-variant">—</span>
            ) : (
              selected.map((v) => {
                const lbl = options.find((o) => o.value === v)?.label ?? v;
                return (
                  <span
                    key={v}
                    className="rounded-lg bg-secondary-container px-2.5 py-0.5 text-xs font-semibold text-on-secondary-container"
                  >
                    {lbl}
                  </span>
                );
              })
            )}
          </div>
        ) : (
          <Select
            id={id}
            multiple
            options={options}
            value={selected}
            searchable={cfg?.searchable}
            placeholder={`Select ${label.toLowerCase()}`}
            required={required}
            optional={optional}
            error={error}
            onChange={(val) => onChange(field.columnName, val)}
          />
        )}
      </div>
    );
  }

  // ── textarea ── (API `type: "textarea"` OR a known registration textarea column)
  if (field.type === "textarea" || TEXTAREA_COLUMNS.has(field.columnName)) {
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel id={id} label={label} locked={locked} required={required} optional={optional} />
        <Textarea
          id={id}
          rows={3}
          disabled={disabled}
          required={required}
          error={error}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.columnName, e.target.value)}
          placeholder={disabled ? "—" : `Enter ${label.toLowerCase()}`}
          className={disabled ? "cursor-default opacity-60" : ""}
        />
      </div>
    );
  }

  // ── all other types → Input (number columns forced to a numeric input) ──
  const htmlType =
    field.type === "number" || NUMBER_COLUMNS.has(field.columnName) ? "number"
    : field.type === "email" ? "email"
    : field.type === "url" ? "url"
    : "text";

  return (
    <Input
      id={id}
      label={label}
      type={htmlType}
      disabled={disabled}
      required={required}
      optional={optional}
      error={error}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(field.columnName, e.target.value)}
      placeholder={disabled ? "" : `Enter ${label.toLowerCase()}`}
      className={disabled ? "cursor-default opacity-60" : ""}
      adornment={
        locked ? <Icon name="lock" size={15} className="text-outline-variant" /> : undefined
      }
    />
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { role, isLoaded } = useAuth();
  // True for both "admin" and "super_admin" — both use the admin profile endpoint.
  const isAdminUser = isStaffRole(role);
  // Active section list — admin profiles show only account details; user profiles
  // show the full role-specific section tree.
  const activeSections = isAdminUser ? ADMIN_PROFILE_SECTIONS : PROFILE_SECTIONS;

  const [fields, setFields] = useState<ProfileField[]>([]);
  const [localValues, setLocalValues] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Client-side validation messages, keyed by column (see `validateFields`).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Document being previewed in the shared modal ({ s3Key, title }); null = closed.
  const [preview, setPreview] = useState<{ s3Key: string; title: string } | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      // Admin / super-admin → dedicated self-service endpoint (no authorize() gate).
      // Regular user → existing users/profile endpoint.
      const res = isAdminUser ? await getAdminProfile() : await getUserProfile();
      // `user_profile_field_master` configures some columns twice — once against the
      // `company` source table and once against `user` (company_email, mobile_number,
      // country_code) — so the API returns two entries for them. Keep the last (the
      // `user` row, which is what edits are saved against); otherwise the field renders
      // twice with a duplicate React key.
      const fetched = [...new Map((res.data ?? []).map((f) => [f.columnName, f])).values()];
      setFields(fetched);
      const init: Record<string, string | string[]> = {};
      for (const f of fetched) init[f.columnName] = normalizeValue(f);
      setLocalValues(init);
    } catch (err) {
      toast.error((err as ApiError).message ?? "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [isAdminUser]);

  // Wait for the session to be read from localStorage before fetching — otherwise
  // `isAdminUser` is always false on the first render and the wrong endpoint is called.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (isLoaded) fetchProfile(); }, [fetchProfile, isLoaded]);

  const handleChange = (col: string, val: string | string[]) => {
    // Clear this column's error as soon as the user edits it; it's re-checked on save.
    // Dial-code changes re-check the number against a different country rule, so drop
    // the stale mobile_number message too.
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (prev[col]) next[col] = "";
      if (col === PHONE_CODE_COL && prev[PHONE_NUMBER_COL]) next[PHONE_NUMBER_COL] = "";
      return next;
    });
    setLocalValues((prev) => {
      const next = { ...prev, [col]: val };
      // Country → Continent cascade, same as the registration complete-profile
      // step: picking a country auto-fills its continent.
      if (col === "country" && typeof val === "string") {
        const continent = continentForCountry(val);
        if (continent) next.continent = continent;
      }
      return next;
    });
  };

  const handleToggleEdit = (on: boolean) => {
    if (!on) {
      // Discard changes: reset to fetched values
      const init: Record<string, string | string[]> = {};
      for (const f of fields) init[f.columnName] = normalizeValue(f);
      setLocalValues(init);
    }
    setFieldErrors({});
    setEditMode(on);
  };

  // Whether the API returned the digits column, so the dial-code column can be
  // folded into the combined phone widget instead of rendered on its own.
  const hasPhoneNumber = fields.some((f) => f.columnName === PHONE_NUMBER_COL);
  // Whether the funding-min column is present, so currency + max fold into the
  // single "Funding Ask Amount" widget.
  const hasFundingMin = fields.some((f) => f.columnName === FUNDING_MIN_COL);
  const hasTicketMin = fields.some((f) => f.columnName === TICKET_MIN_COL);

  // Render one field as the right control (combined widgets for phone / funding,
  // otherwise the generic row), wrapped with the correct column span.
  const renderField = (field: ProfileField) => {
    // Founders → name + LinkedIn rows. Must come before the generic array branch,
    // which assumes option codes and would try to render an object as a chip.
    if (field.columnName === FOUNDERS_COL) {
      return (
        <div key={field.columnName} className="sm:col-span-2">
          <FoundersField
            label={field.label ?? "Founders & LinkedIn"}
            founders={parseFounders(field.value)}
          />
        </div>
      );
    }

    // Profile picture → avatar + upload control (never a raw storage-key text input).
    if (field.columnName === PHOTO_COL) {
      return (
        <div key={field.columnName} className="sm:col-span-2">
          <PhotoField
            label={field.label ?? "Profile Photo"}
            photoKey={toStringValue(localValues[PHOTO_COL] ?? normalizeValue(field))}
            locked={!field.isEditable}
            editable={editMode && field.isEditable}
            onUploaded={(key) => handleChange(PHOTO_COL, key)}
          />
        </div>
      );
    }

    // Optional intro video → upload / replace / remove while editing, Preview (modal player)
    // always. Re-keyed on edit-mode toggle so a discarded edit drops its local file.
    if (field.columnName === INTRO_VIDEO_COL) {
      return (
        <div key={field.columnName} className="sm:col-span-2">
          <VideoUploadField
            key={editMode ? "edit" : "view"}
            label={field.label ?? "Intro Video"}
            value={toStringValue(localValues[INTRO_VIDEO_COL] ?? normalizeValue(field))}
            locked={!field.isEditable}
            editable={editMode && field.isEditable}
            onChange={(key) => handleChange(INTRO_VIDEO_COL, key)}
          />
        </div>
      );
    }

    // Uploaded document → presence + Preview button (opens the shared modal), plus an
    // Upload/Replace control while editing.
    const docType = DOCUMENT_COLUMNS.get(field.columnName);
    if (docType) {
      const s3Key = toStringValue(localValues[field.columnName] ?? normalizeValue(field));
      const label = field.label ?? field.columnName;
      return (
        <div key={field.columnName}>
          <DocumentField
            label={label}
            s3Key={s3Key}
            locked={!field.isEditable}
            editable={editMode && field.isEditable}
            docType={docType}
            onPreview={() => setPreview({ s3Key, title: label })}
            onUploaded={(key) => handleChange(field.columnName, key)}
          />
        </div>
      );
    }

    // Combined "Funding Ask Amount" (currency + min + max) widget.
    if (field.columnName === FUNDING_MIN_COL) {
      return (
        <div key={field.columnName} className="sm:col-span-2">
          <AmountRangeField
            id="profile-field-funding_ask"
            label="Funding Ask Amount"
            locked={!field.isEditable}
            disabled={!editMode || !field.isEditable}
            currencyValue={toStringValue(localValues[FUNDING_CURRENCY_COL] ?? "")}
            minValue={toStringValue(localValues[FUNDING_MIN_COL] ?? normalizeValue(field))}
            maxValue={toStringValue(localValues[FUNDING_MAX_COL] ?? "")}
            onCurrencyChange={(v) => handleChange(FUNDING_CURRENCY_COL, v)}
            onMinChange={(v) => handleChange(FUNDING_MIN_COL, v)}
            onMaxChange={(v) => handleChange(FUNDING_MAX_COL, v)}
          />
        </div>
      );
    }

    if (field.columnName === TICKET_MIN_COL) {
      return (
        <div key={field.columnName} className="sm:col-span-2">
          <AmountRangeField
            id="profile-field-ticket_size"
            label="Ticket Size"
            locked={!field.isEditable}
            disabled={!editMode || !field.isEditable}
            currencyValue={toStringValue(localValues[TICKET_CURRENCY_COL] ?? "")}
            minValue={toStringValue(localValues[TICKET_MIN_COL] ?? normalizeValue(field))}
            maxValue={toStringValue(localValues[TICKET_MAX_COL] ?? "")}
            onCurrencyChange={(v) => handleChange(TICKET_CURRENCY_COL, v)}
            onMinChange={(v) => handleChange(TICKET_MIN_COL, v)}
            onMaxChange={(v) => handleChange(TICKET_MAX_COL, v)}
          />
        </div>
      );
    }

    // Combined Country-Code + Mobile-Number widget (registration style).
    if (field.columnName === PHONE_NUMBER_COL) {
      return (
        <div key={field.columnName}>
          <PhoneField
            label={field.label ?? "Contact Number"}
            locked={!field.isEditable}
            disabled={!editMode || !field.isEditable}
            error={fieldErrors[PHONE_NUMBER_COL]}
            codeValue={toStringValue(localValues[PHONE_CODE_COL] ?? "")}
            numberValue={toStringValue(localValues[PHONE_NUMBER_COL] ?? normalizeValue(field))}
            onCodeChange={(v) => handleChange(PHONE_CODE_COL, v)}
            onNumberChange={(v) => handleChange(PHONE_NUMBER_COL, v)}
          />
        </div>
      );
    }

    const cfg = getFieldOptionConfig(field.columnName);
    const fullWidth =
      field.type === "textarea" ||
      field.type === "array" ||
      TEXTAREA_COLUMNS.has(field.columnName) ||
      cfg?.multiple === true;
    return (
      <div key={field.columnName} className={fullWidth ? "sm:col-span-2" : ""}>
        <ProfileFieldRow
          field={field}
          value={localValues[field.columnName] ?? normalizeValue(field)}
          editMode={editMode}
          onChange={handleChange}
        />
      </div>
    );
  };

  // Look up fields by column, and track which columns are folded into a widget
  // (so they aren't double-rendered or pushed into the trailing section).
  const fieldByColumn = new Map(fields.map((f) => [f.columnName, f]));
  const foldedColumns = new Set<string>([
    ...(hasPhoneNumber ? [PHONE_CODE_COL] : []),
    ...(hasFundingMin ? [FUNDING_CURRENCY_COL, FUNDING_MAX_COL] : []),
    ...(hasTicketMin ? [TICKET_CURRENCY_COL, TICKET_MAX_COL] : []),
  ]);
  const sectionColumns = new Set(activeSections.flatMap((s) => s.columns));
  // Any returned field not placed in a section (and not folded) — shown last so
  // nothing silently disappears if the backend adds a new column.
  const leftoverFields = fields.filter(
    (f) => !sectionColumns.has(f.columnName) && !foldedColumns.has(f.columnName),
  );

  const handleSave = async () => {
    if (saving) return;

    // Block the request on invalid input; messages render under their own field.
    const found = validateFields(fields, localValues);
    setFieldErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(`profile-field-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      // Backend-shaped payload (snake_case `user` columns, same keys as
      // registration's build-profile) — only the changed columns — sent via
      // PUT /users/profile.
      const payload = buildPayload(fields, localValues);
      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save.");
        setEditMode(false);
        return;
      }
      const res = isAdminUser ? await saveAdminProfile(payload) : await saveUserProfile(payload);
      toast.success(res.message ?? "Profile saved successfully!");
      // Reflect the saved values back into `fields` so a later "Discard" resets to
      // the latest saved state (not the stale fetched one).
      setFields((prev) =>
        prev.map((f) => ({ ...f, value: localValues[f.columnName] ?? normalizeValue(f) })),
      );
      setEditMode(false);
    } catch (err) {
      const e = err as ApiError;
      // Surface the first backend field-validation error if present, else the message.
      const fieldErrs = (e.data as { data?: { field: string; message: string }[] } | undefined)?.data;
      toast.error(fieldErrs?.[0]?.message ?? e.message ?? "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Page Header ── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/20 bg-surface-container-lowest px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            // Prefer the working copy so a photo swapped in edit mode shows at once.
            photoKey={toStringValue(localValues[PHOTO_COL] ?? "") || profilePhotoKey(fields)}
            alt="My Profile Photo"
            className="size-10 shrink-0 rounded-full sm:size-11"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container sm:size-11">
              <Icon name="account_circle" size={24} />
            </div>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate font-headline text-lg font-bold text-on-surface sm:text-xl">
              {isAdminUser ? "Admin Profile" : "My Profile"}
            </h1>
            <p className="truncate text-xs text-on-surface-variant">
              {isAdminUser ? "View and manage your admin account details" : "View and manage your profile details"}
            </p>
          </div>
        </div>

        {/* Edit toggle in top-right */}
        {!loading && fields.length > 0 && (
          <div className="shrink-0">
            <ToggleSwitch
              id="profile-edit-toggle"
              checked={editMode}
              onChange={handleToggleEdit}
              label={editMode ? "Editing" : "Edit"}
            />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="thin-scrollbar flex-1 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-7">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader size="medium" />
          </div>
        ) : fields.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-on-surface-variant">
            <Icon name="person_off" size={48} />
            <p className="text-sm">No profile data found.</p>
            <button
              type="button"
              onClick={fetchProfile}
              className="mt-1 rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-container"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            {/* Edit-mode banner */}
            {editMode && (
              <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary-container/30 px-3 py-3 text-xs text-on-primary-container sm:px-4 sm:text-sm">
                <Icon name="edit_note" size={18} className="mt-0.5 shrink-0" />
                <span>Edit mode is on — make your changes and click <strong>Save Changes</strong> below.</span>
              </div>
            )}

            <div className="flex flex-col gap-8">
              {activeSections.map((section) => {
                // Columns this section owns that the API actually returned, in order.
                const present = section.columns
                  .map((col) => fieldByColumn.get(col))
                  .filter((f): f is ProfileField => Boolean(f));
                if (present.length === 0) return null;
                return (
                  <section key={section.title} className="flex flex-col gap-4">
                    <h3 className="border-b border-outline-variant/20 pb-2 font-headline text-sm font-bold uppercase tracking-wide text-on-surface">
                      {section.title}
                    </h3>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {present.map(renderField)}
                    </div>
                  </section>
                );
              })}

              {/* Safety net: anything the API returns that no section claims still
                  renders, so a new backend column is never silently invisible. */}
              {leftoverFields.length > 0 && (
                <section className="flex flex-col gap-4">
                  <h3 className="border-b border-outline-variant/20 pb-2 font-headline text-sm font-bold uppercase tracking-wide text-on-surface">
                    Additional Information
                  </h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {leftoverFields.map(renderField)}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer — only in edit mode ── */}
      {editMode && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-outline-variant/20 bg-surface-container-lowest px-4 py-3 sm:gap-3 sm:px-6 sm:py-4 md:px-8">
          <button
            type="button"
            onClick={() => handleToggleEdit(false)}
            className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant/30 px-4 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container sm:px-5"
          >
            Discard
          </button>
          <Button
            id="profile-save-btn"
            disabled={saving}
            onClick={handleSave}
            className="h-10 whitespace-nowrap px-6 text-sm max-sm:px-4 max-sm:text-sm"
          >
            {saving ? (
              <Loader size="small" />
            ) : (
              <>
                <Icon name="save" size={16} />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}

      {/* Document preview (Incorporation Certificate / Pitch Deck) */}
      <DocumentPreviewModal
        s3Key={preview?.s3Key ?? null}
        title={preview?.title}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
