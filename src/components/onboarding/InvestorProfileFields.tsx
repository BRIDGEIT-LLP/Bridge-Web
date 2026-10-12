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
import { COUNTRIES, CONTINENTS, continentForCountry } from "@/lib/countries";
import {
  INDUSTRY_SECTORS,
  CURRENCIES,
  URL_REGEX,
  LINKEDIN_URL_PATTERN,
} from "@/lib/startup-profile-options";
import {
  INVESTMENT_STAGES,
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
  linkedinUrl: "",
  websiteUrl: "",
  address: "",
};

interface InvestorProfileFieldsProps {
  control: Control<CompleteProfileForm>;
  register: UseFormRegister<CompleteProfileForm>;
  setValue: UseFormSetValue<CompleteProfileForm>;
  errors: FieldErrors<CompleteProfileForm>;
}

const SECTION_TITLE = "text-base font-semibold text-on-surface";

export function InvestorProfileFields({ control, register, setValue, errors }: InvestorProfileFieldsProps) {
  const e = errors.investor;
  const portfolioOverview = useWatch({ control, name: "investor.portfolioOverview" });
  const portfolioWords = wordCount(portfolioOverview ?? "");
  const geoContinents = useWatch({ control, name: "investor.geoContinents" });
  // Registered once so we can chain RHF's onChange with the hard word-cap below.
  const portfolioReg = register("investor.portfolioOverview", {
    validate: (v) =>
      wordCount(v) <= PORTFOLIO_MAX_WORDS ||
      `Keep the overview under ${PORTFOLIO_MAX_WORDS} words.`,
  });

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
          <Select
            multiple
            id="investmentStages"
            label="Preferred Investment Stages"
            required
            placeholder="Select one or more stages"
            options={INVESTMENT_STAGES}
            value={field.value}
            onChange={field.onChange}
            error={e?.investmentStages?.message}
          />
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

      {/* Geographic investment preference: countries + continents (at least one) */}
      <div className="flex flex-col gap-3">
        <span className="px-1 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Geographic Investment Preference<span className="align-middle text-base leading-none text-error"> *</span>
        </span>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Controller
            control={control}
            name="investor.geoCountries"
            rules={{
              validate: (v, all) =>
                v.length + all.investor.geoContinents.length > 0 ||
                "Select at least one country or continent.",
            }}
            render={({ field }) => (
              <Select
                multiple
                searchable
                id="geoCountries"
                placeholder="Select countries"
                options={COUNTRIES}
                value={field.value}
                onChange={(v) => {
                  const prev = field.value ?? [];
                  field.onChange(v);
                  // Continents derived from the countries selected before/after
                  // this change.
                  const derivedBefore = new Set(
                    prev.map((c) => continentForCountry(c)).filter(Boolean),
                  );
                  const derivedAfter = new Set(
                    v.map((c) => continentForCountry(c)).filter(Boolean),
                  );
                  // Continents whose only backing country was just removed.
                  const dropped = [...derivedBefore].filter(
                    (cont) => !derivedAfter.has(cont),
                  );
                  // Keep manually-picked continents + drop auto-derived ones whose
                  // country is gone, then re-add the continents still backed by a
                  // selected country.
                  const next = (geoContinents ?? []).filter(
                    (cont) => !dropped.includes(cont),
                  );
                  const merged = Array.from(new Set([...next, ...derivedAfter]));
                  setValue("investor.geoContinents", merged, { shouldValidate: true });
                }}
                error={e?.geoCountries?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="investor.geoContinents"
            render={({ field }) => (
              <Select
                multiple
                id="geoContinents"
                placeholder="Select continents"
                options={CONTINENTS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

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
