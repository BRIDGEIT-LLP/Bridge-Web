"use client";

import React from "react";
import {
  Controller,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type FieldErrors,
} from "react-hook-form";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { URL_REGEX, LINKEDIN_URL_PATTERN } from "@/lib/startup-profile-options";
import {
  SECTOR_OPTIONS,
  subSectorOptions,
  verticalOptions,
  BUSINESS_TYPES,
  MOQ_REQUIRED_TYPES,
  REVENUE_BANDS,
  EXPORT_READINESS,
  BUSINESS_INTENTS,
  B2B_GEOGRAPHY_REGIONS,
  PRODUCTS_MAX_CHARS,
  REQUIREMENTS_MAX_CHARS,
} from "@/lib/b2b-profile-options";
import type { CompleteProfileForm } from "@/components/onboarding/StartupProfileFields";

export interface B2BValues {
  businessName: string;
  sector: string;
  subSector: string;
  industryVertical: string;
  businessType: string;
  moq: string;
  revenueBand: string;
  geoCountries: string[];
  geoContinents: string[];
  exportReadiness: string;
  yearsInOperation: string;
  productsServices: string;
  businessRequirements: string;
  businessIntent: string;
  /** New UI "Operational capacity (optional)"; saved as operational_capacity_description. */
  operationalCapacity?: string;
  linkedinUrl: string;
  websiteUrl: string;
  address: string;
}

export const defaultB2BValues: B2BValues = {
  businessName: "",
  sector: "",
  subSector: "",
  industryVertical: "",
  businessType: "",
  moq: "",
  revenueBand: "",
  geoCountries: [],
  geoContinents: [],
  exportReadiness: "",
  yearsInOperation: "",
  productsServices: "",
  businessRequirements: "",
  businessIntent: "",
  operationalCapacity: "",
  linkedinUrl: "",
  websiteUrl: "",
  address: "",
};

interface B2BProfileFieldsProps {
  control: Control<CompleteProfileForm>;
  register: UseFormRegister<CompleteProfileForm>;
  setValue: UseFormSetValue<CompleteProfileForm>;
  errors: FieldErrors<CompleteProfileForm>;
  /** Registration only: the new UI asks for intent on its own "Intent" screen. Dashboard editors leave this false. */
  hideIntent?: boolean;
  /**
   * Registration only: lay the form out like the new UI (the prototype's fields first, every field
   * from the previous UI kept in an optional collapsible block). Dashboard editors leave this false.
   */
  newUi?: boolean;
}

/*
 * NOT IN NEW UI (kept from the previous UI so nothing is lost): B2B sector, business type, industry
 * vertical, geography by country/continent (new UI has broad regions), separate business name, address.
 */
export function B2BProfileFields({ control, register, setValue, errors, hideIntent = false, newUi = false }: B2BProfileFieldsProps) {
  const [legacyOpen, setLegacyOpen] = React.useState(false);
  const e = errors.b2b;

  const sector = useWatch({ control, name: "b2b.sector" });
  const subSector = useWatch({ control, name: "b2b.subSector" });
  const businessType = useWatch({ control, name: "b2b.businessType" });
  const products = useWatch({ control, name: "b2b.productsServices" });
  const requirements = useWatch({ control, name: "b2b.businessRequirements" });

  const moqRequired = MOQ_REQUIRED_TYPES.includes(businessType);
  const productChars = (products ?? "").length;
  const requirementChars = (requirements ?? "").length;

  if (newUi) {
    // Legacy fields are always mounted (so their values are kept); the block opens itself on an error.
    const legacyHasError = !!(e?.industryVertical || e?.address);
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="b2b.sector"
            rules={{ required: "Select a sector." }}
            render={({ field }) => (
              <Select
                id="sector"
                label="Sector"
                required
                placeholder="Select sector"
                options={SECTOR_OPTIONS}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  // Reset dependent selections when the parent changes.
                  setValue("b2b.subSector", "", { shouldValidate: false });
                  setValue("b2b.industryVertical", "", { shouldValidate: false });
                }}
                error={e?.sector?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="b2b.subSector"
            rules={{ required: "Select a sub-sector." }}
            render={({ field }) => (
              <Select
                id="subSector"
                label="Sub-sector"
                required
                placeholder={sector ? "Select sub-sector" : "Select a sector first"}
                disabled={!sector}
                options={subSectorOptions(sector)}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setValue("b2b.industryVertical", "", { shouldValidate: false });
                }}
                error={e?.subSector?.message}
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="b2b.revenueBand"
          rules={{ required: "Select your revenue band." }}
          render={({ field }) => (
            <Select
              id="revenueBand"
              label="Annual revenue"
              required
              placeholder="Select a band"
              options={REVENUE_BANDS}
              value={field.value}
              onChange={field.onChange}
              error={e?.revenueBand?.message}
            />
          )}
        />
        <Input
          variant="ux"
          id="yearsInOperation"
          type="number"
          min={0}
          label="Years in operation"
          required
          placeholder="12"
          error={e?.yearsInOperation?.message}
          {...register("b2b.yearsInOperation", {
            required: "Add years in operation",
            min: { value: 0, message: "Enter a valid number of years." },
          })}
        />
        <Input
          variant="ux"
          id="moq"
          type="number"
          min={0}
          label="Minimum order quantity"
          required
          placeholder="500"
          error={e?.moq?.message}
          {...register("b2b.moq", {
            validate: (v) => (!!v && Number(v) > 0) || "Add minimum order quantity",
          })}
        />
        <Controller
          control={control}
          name="b2b.exportReadiness"
          rules={{ required: "Select your export readiness." }}
          render={({ field }) => (
            <Select
              id="exportReadiness"
              label="Export ready"
              required
              placeholder="Select"
              options={EXPORT_READINESS}
              value={field.value}
              onChange={field.onChange}
              error={e?.exportReadiness?.message}
            />
          )}
        />
        <div className="flex flex-col gap-1">
          <Textarea
            id="productsServices"
            label="Products or services"
            required
            rows={3}
            maxLength={PRODUCTS_MAX_CHARS}
            placeholder="What you make or offer"
            error={e?.productsServices?.message}
            {...register("b2b.productsServices", {
              required: "Describe the products or services you offer.",
              maxLength: { value: PRODUCTS_MAX_CHARS, message: `Keep it under ${PRODUCTS_MAX_CHARS} characters.` },
            })}
          />
          <span className={`px-1 text-xs font-medium ${productChars > PRODUCTS_MAX_CHARS ? "text-error" : "text-on-surface-variant"}`}>
            {productChars} / {PRODUCTS_MAX_CHARS} characters
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Textarea
            id="businessRequirements"
            label="What you need"
            required
            rows={3}
            maxLength={REQUIREMENTS_MAX_CHARS}
            placeholder="Partners, buyers or suppliers you are looking for"
            error={e?.businessRequirements?.message}
            {...register("b2b.businessRequirements", {
              required: "Describe your business requirements.",
              maxLength: { value: REQUIREMENTS_MAX_CHARS, message: `Keep it under ${REQUIREMENTS_MAX_CHARS} characters.` },
            })}
          />
          <span className={`px-1 text-xs font-medium ${requirementChars > REQUIREMENTS_MAX_CHARS ? "text-error" : "text-on-surface-variant"}`}>
            {requirementChars} / {REQUIREMENTS_MAX_CHARS} characters
          </span>
        </div>
        <Controller
          control={control}
          name="b2b.geoCountries"
          rules={{ validate: (v) => v.length > 0 || "Select at least one region." }}
          render={({ field }) => (
            <div className="flex flex-col gap-2" id="geoCountries" tabIndex={-1}>
              <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
                Where you sell<span className="align-middle text-base leading-none text-error"> *</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {B2B_GEOGRAPHY_REGIONS.map((o) => {
                  const on = field.value.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => field.onChange(on ? field.value.filter((v) => v !== o.value) : [...field.value, o.value])}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        on
                          ? "border-primary bg-primary-container font-semibold text-primary"
                          : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary/60"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {e?.geoCountries?.message && (
                <span className="px-1 text-xs font-medium text-error">{e.geoCountries.message}</span>
              )}
            </div>
          )}
        />
        <Textarea
          id="operationalCapacity"
          label="Operational capacity (optional)"
          rows={3}
          placeholder="1,200 tonnes a month"
          {...register("b2b.operationalCapacity")}
        />

        {/* NOT IN NEW UI: kept from the previous UI. Everything in here is optional. */}
        <details
          open={legacyOpen || legacyHasError}
          onToggle={(ev) => setLegacyOpen((ev.currentTarget as HTMLDetailsElement).open)}
          className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
        >
          <summary className="cursor-pointer text-sm font-semibold text-on-surface">
            More business details (optional, from the previous form)
          </summary>
          <div className="mt-4 flex flex-col gap-6">
            <Input
              id="businessName"
              label="Business Name"
              readOnly
              adornment={<Icon name="lock" size={18} />}
              className="cursor-not-allowed text-on-surface-variant"
              {...register("b2b.businessName")}
            />
            <Controller
              control={control}
              name="b2b.industryVertical"
              render={({ field }) => (
                <Select
                  id="industryVertical"
                  label="Industry Vertical"
                  optional
                  placeholder={subSector ? "Select vertical" : "Select a sub-sector first"}
                  disabled={!subSector}
                  options={verticalOptions(sector, subSector)}
                  value={field.value}
                  onChange={field.onChange}
                  error={e?.industryVertical?.message}
                />
              )}
            />
            <Textarea
              id="address"
              label="Registered Office / Residential Address"
              optional
              rows={3}
              placeholder="Address as per your registration / government ID"
              error={e?.address?.message}
              {...register("b2b.address")}
            />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base font-semibold text-on-surface">Business Profile</p>

      {/* Business Name — sourced from GST data later; locked + pre-filled for now */}
      <Input
        id="businessName"
        label="Business Name"
        required
        readOnly
        adornment={<Icon name="lock" size={18} />}
        className="cursor-not-allowed text-on-surface-variant"
        {...register("b2b.businessName")}
      />

      {/* Sector → Sub-Sector → Industry Vertical (cascading) */}
      <Controller
        control={control}
        name="b2b.sector"
        rules={{ required: "Select a sector." }}
        render={({ field }) => (
          <Select
            id="sector"
            label="Sector"
            required
            placeholder="Select sector"
            options={SECTOR_OPTIONS}
            value={field.value}
            onChange={(v) => {
              field.onChange(v);
              // Reset dependent selections when the parent changes.
              setValue("b2b.subSector", "", { shouldValidate: false });
              setValue("b2b.industryVertical", "", { shouldValidate: false });
            }}
            error={e?.sector?.message}
          />
        )}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Controller
          control={control}
          name="b2b.subSector"
          rules={{ required: "Select a sub-sector." }}
          render={({ field }) => (
            <Select
              id="subSector"
              label="Sub-Sector"
              required
              placeholder={sector ? "Select sub-sector" : "Select a sector first"}
              disabled={!sector}
              options={subSectorOptions(sector)}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                setValue("b2b.industryVertical", "", { shouldValidate: false });
              }}
              error={e?.subSector?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="b2b.industryVertical"
          rules={{ required: "Select an industry vertical." }}
          render={({ field }) => (
            <Select
              id="industryVertical"
              label="Industry Vertical"
              required
              placeholder={subSector ? "Select vertical" : "Select a sub-sector first"}
              disabled={!subSector}
              options={verticalOptions(sector, subSector)}
              value={field.value}
              onChange={field.onChange}
              error={e?.industryVertical?.message}
            />
          )}
        />
      </div>

      {/* Business Type + MOQ (MOQ required only for product businesses) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Business Type is hidden for now and is not a required attribute.
        <Controller
          control={control}
          name="b2b.businessType"
          render={({ field }) => (
            <Select
              id="businessType"
              label="Business Type"
              placeholder="Select type"
              options={BUSINESS_TYPES}
              value={field.value}
              onChange={field.onChange}
              error={e?.businessType?.message}
            />
          )}
        />
        */}
        <Input
          id="moq"
          type="number"
          min={0}
          label="Min Order Quantity (MOQ)"
          required={moqRequired}
          optional={!moqRequired}
          placeholder="e.g. 500"
          error={e?.moq?.message}
          {...register("b2b.moq", {
            validate: (v) =>
              !moqRequired || (!!v && Number(v) > 0) || "MOQ is required for product businesses.",
          })}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Controller
          control={control}
          name="b2b.revenueBand"
          rules={{ required: "Select your revenue band." }}
          render={({ field }) => (
            <Select
              id="revenueBand"
              label="Revenue Band"
              required
              placeholder="Select revenue band"
              options={REVENUE_BANDS}
              value={field.value}
              onChange={field.onChange}
              error={e?.revenueBand?.message}
            />
          )}
        />
        <Input
          id="yearsInOperation"
          type="number"
          min={0}
          label="Years in Operation"
          required
          placeholder="e.g. 8"
          error={e?.yearsInOperation?.message}
          {...register("b2b.yearsInOperation", {
            required: "Years in operation is required.",
            min: { value: 0, message: "Enter a valid number of years." },
          })}
        />
      </div>

      {/* Where you sell: region chips (at least one). Stored in b2b_geography_country. */}
      <Controller
        control={control}
        name="b2b.geoCountries"
        rules={{ validate: (v) => v.length > 0 || "Select at least one region." }}
        render={({ field }) => (
          <div className="flex flex-col gap-2" id="geoCountries" tabIndex={-1}>
            <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
              Where you sell<span className="align-middle text-base leading-none text-error"> *</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {B2B_GEOGRAPHY_REGIONS.map((o) => {
                const on = field.value.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      field.onChange(on ? field.value.filter((v) => v !== o.value) : [...field.value, o.value])
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary-container font-semibold text-primary"
                        : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary/60"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {e?.geoCountries?.message && (
              <span className="px-1 text-xs font-medium text-error">{e.geoCountries.message}</span>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Controller
          control={control}
          name="b2b.exportReadiness"
          rules={{ required: "Select your export readiness." }}
          render={({ field }) => (
            <Select
              id="exportReadiness"
              label="Export Readiness"
              required
              placeholder="Select readiness"
              options={EXPORT_READINESS}
              value={field.value}
              onChange={field.onChange}
              error={e?.exportReadiness?.message}
            />
          )}
        />
        {!hideIntent && (
          <Controller
            control={control}
            name="b2b.businessIntent"
            rules={{ required: "Select your business intent." }}
            render={({ field }) => (
              <Select
                id="businessIntent"
                label="Business Intent"
                required
                placeholder="Select intent"
                options={BUSINESS_INTENTS}
                value={field.value}
                onChange={field.onChange}
                error={e?.businessIntent?.message}
              />
            )}
          />
        )}
      </div>

      {/* Products / Services Offered (structured text) */}
      <div className="flex flex-col gap-1">
        <Textarea
          id="productsServices"
          label="Products / Services Offered"
          required
          rows={4}
          maxLength={PRODUCTS_MAX_CHARS}
          placeholder="List the products or services your business offers…"
          error={e?.productsServices?.message}
          {...register("b2b.productsServices", {
            required: "Describe the products or services you offer.",
            maxLength: {
              value: PRODUCTS_MAX_CHARS,
              message: `Keep it under ${PRODUCTS_MAX_CHARS} characters.`,
            },
          })}
        />
        <span
          className={`px-1 text-xs font-medium ${
            productChars > PRODUCTS_MAX_CHARS ? "text-error" : "text-on-surface-variant"
          }`}
        >
          {productChars} / {PRODUCTS_MAX_CHARS} characters
        </span>
      </div>

      {/* Business Requirements (structured text) */}
      <div className="flex flex-col gap-1">
        <Textarea
          id="businessRequirements"
          label="Business Requirements"
          required
          rows={4}
          maxLength={REQUIREMENTS_MAX_CHARS}
          placeholder="Describe what you are looking for from partners…"
          error={e?.businessRequirements?.message}
          {...register("b2b.businessRequirements", {
            required: "Describe your business requirements.",
            maxLength: {
              value: REQUIREMENTS_MAX_CHARS,
              message: `Keep it under ${REQUIREMENTS_MAX_CHARS} characters.`,
            },
          })}
        />
        <span
          className={`px-1 text-xs font-medium ${
            requirementChars > REQUIREMENTS_MAX_CHARS ? "text-error" : "text-on-surface-variant"
          }`}
        >
          {requirementChars} / {REQUIREMENTS_MAX_CHARS} characters
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Input
          type="url"
          label="LinkedIn Profile"
          optional
          placeholder="https://linkedin.com/company/…"
          error={e?.linkedinUrl?.message}
          {...register("b2b.linkedinUrl", {
            validate: (v) =>
              !v || new RegExp(LINKEDIN_URL_PATTERN, "i").test(v) || "Enter a valid LinkedIn URL.",
          })}
        />
        <Input
          type="url"
          label="Company Website"
          optional
          placeholder="https://yourcompany.com"
          error={e?.websiteUrl?.message}
          {...register("b2b.websiteUrl", {
            validate: (v) => !v || URL_REGEX.test(v) || "Enter a valid URL.",
          })}
        />
      </div>

      <Textarea
        id="address"
        label="Registered Office / Residential Address"
        required
        rows={3}
        placeholder="Address as per your registration / government ID"
        error={e?.address?.message}
        {...register("b2b.address", { required: "Address is required." })}
      />
    </div>
  );
}
