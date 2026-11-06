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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import {
  INDUSTRY_SECTORS,
  CURRENCIES,
  URL_REGEX,
  LINKEDIN_URL_PATTERN,
} from "@/lib/startup-profile-options";
import {
  INVESTMENT_STAGES,
  INVESTOR_GEOGRAPHY_REGIONS,
  INVESTOR_TYPES,
  PRIMARY_INTENT_OPTIONS,
  PORTFOLIO_MAX_WORDS,
} from "@/lib/investor-profile-options";
import { wordCount, limitWords, type CompleteProfileForm } from "@/components/onboarding/StartupProfileFields";

/** All investor profile field values (everything here is JSON-serializable). */
export interface InvestorValues {
  sectorPreferences: string[];
  investmentStages: string[];
  ticketCurrency: string;
  ticketMin: string;
  ticketMax: string;
  geoCountries: string[];
  geoContinents: string[];
  investorType: string;
  primaryIntent: string;
  investmentThesis: string;
  portfolioOverview: string;
  numberOfInvestments: string;
  /** New UI only: the prototype's single-unit cheque range in ₹ Cr. Converted to ticketMin/ticketMax on save when those are blank. */
  ticketMinCr?: string;
  ticketMaxCr?: string;
  linkedinUrl: string;
  websiteUrl: string;
  address: string;
}

export const defaultInvestorValues: InvestorValues = {
  sectorPreferences: [],
  investmentStages: [],
  ticketCurrency: "INR",
  ticketMin: "",
  ticketMax: "",
  geoCountries: [],
  geoContinents: [],
  investorType: "",
  primaryIntent: "",
  investmentThesis: "",
  portfolioOverview: "",
  numberOfInvestments: "",
  ticketMinCr: "",
  ticketMaxCr: "",
  linkedinUrl: "",
  websiteUrl: "",
  address: "",
};

interface InvestorProfileFieldsProps {
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

const SECTION_TITLE = "text-base font-semibold text-on-surface";

/*
 * NOT IN NEW UI (kept from the previous UI so nothing is lost): ticket currency, sector preferences,
 * geographic preference by country/continent (new UI has broad regions), portfolio overview, address.
 */
export function InvestorProfileFields({ control, register, setValue, errors, hideIntent = false, newUi = false }: InvestorProfileFieldsProps) {
  const [legacyOpen, setLegacyOpen] = React.useState(false);
  const e = errors.investor;
  const portfolioOverview = useWatch({ control, name: "investor.portfolioOverview" });
  const portfolioWords = wordCount(portfolioOverview ?? "");
  // Registered once so we can chain RHF's onChange with the hard word-cap below.
  const portfolioReg = register("investor.portfolioOverview", {
    validate: (v) =>
      wordCount(v) <= PORTFOLIO_MAX_WORDS ||
      `Keep the overview under ${PORTFOLIO_MAX_WORDS} words.`,
  });

  if (newUi) {
    // Legacy fields are always mounted (so their values are kept); the block opens itself on an error.
    const legacyHasError = !!(e?.ticketMin || e?.ticketMax || e?.portfolioOverview);
    const chips = (
      name: "investor.investmentStages" | "investor.geoCountries",
      id: string,
      label: string,
      options: { value: string; label: string }[],
      emptyMsg: string,
      err?: string,
    ) => (
      <Controller
        control={control}
        name={name}
        rules={{ validate: (v) => v.length > 0 || emptyMsg }}
        render={({ field }) => (
          <div className="flex flex-col gap-2" id={id} tabIndex={-1}>
            <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
              {label}<span className="align-middle text-base leading-none text-error"> *</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => {
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
            {err && <span className="px-1 text-xs font-medium text-error">{err}</span>}
          </div>
        )}
      />
    );
    return (
      <div className="flex flex-col gap-5">
        <Controller
          control={control}
          name="investor.investorType"
          rules={{ required: "Select your investor type." }}
          render={({ field }) => (
            <Select
              id="investorType"
              label="Investor type"
              required
              placeholder="Select a type"
              options={INVESTOR_TYPES}
              value={field.value}
              onChange={field.onChange}
              error={e?.investorType?.message}
            />
          )}
        />
        <Input
          variant="ux"
          id="ticketMinCr"
          type="number"
          min={0}
          step="any"
          label="Smallest cheque (₹ Cr)"
          required
          placeholder="0.5"
          error={e?.ticketMinCr?.message}
          {...register("investor.ticketMinCr", {
            validate: (v, all) => !!v || !!all.investor.ticketMin || "Enter the smallest cheque",
          })}
        />
        <Input
          variant="ux"
          id="ticketMaxCr"
          type="number"
          min={0}
          step="any"
          label="Largest cheque (₹ Cr)"
          required
          placeholder="5"
          error={e?.ticketMaxCr?.message}
          {...register("investor.ticketMaxCr", {
            validate: (v, all) => {
              if (!v) return !!all.investor.ticketMax || "Enter the largest cheque";
              const min = all.investor.ticketMinCr;
              return !min || Number(v) >= Number(min) || "Largest cheque must be at least the smallest";
            },
          })}
        />
        {chips("investor.investmentStages", "investmentStages", "Stages you invest in", INVESTMENT_STAGES, "Select at least one investment stage.", e?.investmentStages?.message)}
        <Textarea
          id="investmentThesis"
          label="Investment thesis"
          required
          rows={3}
          placeholder="What you back and why"
          error={e?.investmentThesis?.message}
          {...register("investor.investmentThesis", { required: "Add investment thesis" })}
        />
        {chips("investor.geoCountries", "geoCountries", "Where you invest", INVESTOR_GEOGRAPHY_REGIONS, "Select at least one region.", e?.geoCountries?.message)}
        <Input
          variant="ux"
          id="numberOfInvestments"
          type="number"
          min={0}
          label="Investments to date (optional)"
          placeholder="12"
          {...register("investor.numberOfInvestments")}
        />

        {/* NOT IN NEW UI: kept from the previous UI. Everything in here is optional. */}
        <details
          open={legacyOpen || legacyHasError}
          onToggle={(ev) => setLegacyOpen((ev.currentTarget as HTMLDetailsElement).open)}
          className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
        >
          <summary className="cursor-pointer text-sm font-semibold text-on-surface">
            More investor details (optional, from the previous form)
          </summary>
          <div className="mt-4 flex flex-col gap-6">
            <Controller
              control={control}
              name="investor.sectorPreferences"
              render={({ field }) => (
                <Select
                  multiple
                  id="sectorPreferences"
                  label="Sector Preferences"
                  optional
                  placeholder="Select one or more sectors"
                  options={INDUSTRY_SECTORS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <div className="flex flex-col gap-2">
              <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
                Ticket Size<span className="font-medium normal-case text-primary"> (Optional, used instead of the ₹ Cr range above)</span>
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_1fr]">
                <Controller
                  control={control}
                  name="investor.ticketCurrency"
                  render={({ field }) => (
                    <Select aria-label="Currency" options={CURRENCIES} value={field.value} onChange={field.onChange} />
                  )}
                />
                <Input type="number" min={0} placeholder="Min" error={e?.ticketMin?.message} {...register("investor.ticketMin")} />
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  error={e?.ticketMax?.message}
                  {...register("investor.ticketMax", {
                    validate: (v, all) => !v || !all.investor.ticketMin || Number(v) >= Number(all.investor.ticketMin) || "Max must be ≥ min.",
                  })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Textarea
                id="portfolioOverview"
                label="Portfolio Overview"
                optional
                rows={5}
                placeholder="Highlight notable investments, sectors and outcomes…"
                error={e?.portfolioOverview?.message}
                {...portfolioReg}
                onChange={limitWords(PORTFOLIO_MAX_WORDS, portfolioReg.onChange)}
              />
              <span className={`px-1 text-xs font-medium ${portfolioWords > PORTFOLIO_MAX_WORDS ? "text-error" : "text-on-surface-variant"}`}>
                {portfolioWords} / {PORTFOLIO_MAX_WORDS} words
              </span>
            </div>
            <Textarea
              id="address"
              label="Registered Office / Residential Address (as per government ID)"
              optional
              rows={3}
              placeholder="Address as per your government-issued ID"
              {...register("investor.address")}
            />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className={SECTION_TITLE}>Investment Profile</p>

      <Controller
        control={control}
        name="investor.sectorPreferences"
        rules={{ validate: (v) => v.length > 0 || "Select at least one sector preference." }}
        render={({ field }) => (
          <Select
            multiple
            id="sectorPreferences"
            label="Sector Preferences"
            required
            placeholder="Select one or more sectors"
            options={INDUSTRY_SECTORS}
            value={field.value}
            onChange={field.onChange}
            error={e?.sectorPreferences?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="investor.investmentStages"
        rules={{ validate: (v) => v.length > 0 || "Select at least one investment stage." }}
        render={({ field }) => (
          <div className="flex flex-col gap-2" id="investmentStages" tabIndex={-1}>
            <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
              Stages you invest in<span className="align-middle text-base leading-none text-error"> *</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {INVESTMENT_STAGES.map((o) => {
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
            {e?.investmentStages?.message && (
              <span className="px-1 text-xs font-medium text-error">{e.investmentStages.message}</span>
            )}
          </div>
        )}
      />

      {/* Ticket size: currency + min–max range */}
      <div className="flex flex-col gap-2">
        <span className="px-1 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Ticket Size<span className="align-middle text-base leading-none text-error"> *</span>
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_1fr]">
          <Controller
            control={control}
            name="investor.ticketCurrency"
            render={({ field }) => (
              <Select aria-label="Currency" options={CURRENCIES} value={field.value} onChange={field.onChange} />
            )}
          />
          <Input
            type="number"
            min={0}
            placeholder="Min"
            error={e?.ticketMin?.message}
            {...register("investor.ticketMin", { required: "Required." })}
          />
          <Input
            type="number"
            min={0}
            placeholder="Max"
            error={e?.ticketMax?.message}
            {...register("investor.ticketMax", {
              required: "Required.",
              validate: (v, all) =>
                Number(v) >= Number(all.investor.ticketMin) || "Max must be ≥ min.",
            })}
          />
        </div>
      </div>

      {/* Where you invest: region chips (at least one). Stored in geographic_investment_preference. */}
      <Controller
        control={control}
        name="investor.geoCountries"
        rules={{ validate: (v) => v.length > 0 || "Select at least one region." }}
        render={({ field }) => (
          <div className="flex flex-col gap-2" id="geoCountries" tabIndex={-1}>
            <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
              Where you invest<span className="align-middle text-base leading-none text-error"> *</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {INVESTOR_GEOGRAPHY_REGIONS.map((o) => {
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
          name="investor.investorType"
          rules={{ required: "Select your investor type." }}
          render={({ field }) => (
            <Select
              id="investorType"
              label="Investor Type"
              required
              placeholder="Select type"
              options={INVESTOR_TYPES}
              value={field.value}
              onChange={field.onChange}
              error={e?.investorType?.message}
            />
          )}
        />
        {!hideIntent && (
          <Controller
            control={control}
            name="investor.primaryIntent"
            rules={{ required: "Select your primary intent." }}
            render={({ field }) => (
              <Select
                id="primaryIntent"
                label="Primary Intent"
                required
                placeholder="Select intent"
                options={PRIMARY_INTENT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={e?.primaryIntent?.message}
              />
            )}
          />
        )}
      </div>

      <Textarea
        id="investmentThesis"
        label="Investment Thesis"
        optional
        placeholder="What do you look for in an investment?"
        {...register("investor.investmentThesis")}
      />

      {/* Portfolio overview with word counter */}
      <div className="flex flex-col gap-1">
        <Textarea
          id="portfolioOverview"
          label="Portfolio Overview"
          optional
          rows={5}
          placeholder="Highlight notable investments, sectors and outcomes…"
          error={e?.portfolioOverview?.message}
          {...portfolioReg}
          onChange={limitWords(PORTFOLIO_MAX_WORDS, portfolioReg.onChange)}
        />
        <span
          className={`px-1 text-xs font-medium ${
            portfolioWords > PORTFOLIO_MAX_WORDS ? "text-error" : "text-on-surface-variant"
          }`}
        >
          {portfolioWords} / {PORTFOLIO_MAX_WORDS} words
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Input
          type="number"
          min={0}
          label="Number of Investments to Date"
          optional
          placeholder="e.g. 12"
          {...register("investor.numberOfInvestments")}
        />
        <Input
          type="url"
          label="LinkedIn Profile"
          optional
          placeholder="https://linkedin.com/in/…"
          error={e?.linkedinUrl?.message}
          {...register("investor.linkedinUrl", {
            validate: (v) =>
              !v || new RegExp(LINKEDIN_URL_PATTERN, "i").test(v) || "Enter a valid LinkedIn URL.",
          })}
        />
        <Input
          type="url"
          label="Company Website"
          optional
          placeholder="https://yourfund.com"
          error={e?.websiteUrl?.message}
          {...register("investor.websiteUrl", {
            validate: (v) => !v || URL_REGEX.test(v) || "Enter a valid URL.",
          })}
        />
      </div>

      <Textarea
        id="address"
        label="Registered Office / Residential Address (as per government ID)"
        required
        rows={3}
        placeholder="Address as per your government-issued ID"
        error={e?.address?.message}
        {...register("investor.address", { required: "Address is required." })}
      />
    </div>
  );
}
