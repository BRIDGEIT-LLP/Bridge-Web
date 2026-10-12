/**
 * Shared validation regexes — the single source of truth for field formats.
 * Import these instead of re-declaring patterns at the top of a page/component.
 * (URL_REGEX intentionally lives in `startup-profile-options.ts` alongside the
 * profile-options it validates.)
 */

/** Basic email shape: something@something.tld */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Indian 10-digit mobile (starts 6–9). Only correct when the dial code is `+91`.
 * Prefer `phoneErrorForDialCode` anywhere the UI offers `DIAL_CODES`.
 */
export const PHONE_REGEX = /^[6-9]\d{9}$/;

type PhoneRule = { pattern: RegExp; message: string };

const phoneRule = (pattern: RegExp, message: string): PhoneRule => ({ pattern, message });

/**
 * National-number rules keyed by the dial codes in `DIAL_CODES`.
 * The number field is the national part only (no `+`, no country code, no leading 0).
 * Lengths follow typical ITU NSN ranges for that country — mobile-leaning, but
 * landline lengths are accepted where the field is a generic "contact number".
 */
const PHONE_BY_DIAL: Record<string, PhoneRule> = {
  "+91": phoneRule(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  "+1": phoneRule(/^[2-9]\d{9}$/, "Enter a valid 10-digit US/Canada number."),
  "+44": phoneRule(/^\d{10}$/, "Enter a valid 10-digit UK number (without the leading 0)."),
  "+971": phoneRule(/^\d{8,9}$/, "Enter a valid 8–9 digit UAE number."),
  "+65": phoneRule(/^[3689]\d{7}$/, "Enter a valid 8-digit Singapore number."),
  "+61": phoneRule(/^[2-478]\d{8}$/, "Enter a valid 9-digit Australian number."),
  "+49": phoneRule(/^\d{10,13}$/, "Enter a valid 10–13 digit German number."),
  "+33": phoneRule(/^[1-9]\d{8}$/, "Enter a valid 9-digit French number."),
  "+39": phoneRule(/^\d{9,10}$/, "Enter a valid 9–10 digit Italian number."),
  "+34": phoneRule(/^[6-9]\d{8}$/, "Enter a valid 9-digit Spanish number."),
  "+31": phoneRule(/^\d{9}$/, "Enter a valid 9-digit Dutch number."),
  "+41": phoneRule(/^[1-9]\d{8}$/, "Enter a valid 9-digit Swiss number."),
  "+46": phoneRule(/^\d{7,9}$/, "Enter a valid 7–9 digit Swedish number."),
  "+47": phoneRule(/^[2-9]\d{7}$/, "Enter a valid 8-digit Norwegian number."),
  "+353": phoneRule(/^\d{9}$/, "Enter a valid 9-digit Irish number."),
  "+351": phoneRule(/^[2-9]\d{8}$/, "Enter a valid 9-digit Portuguese number."),
  "+7": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Russian number."),
  "+86": phoneRule(/^\d{10,11}$/, "Enter a valid 10–11 digit Chinese number."),
  "+81": phoneRule(/^\d{9,10}$/, "Enter a valid 9–10 digit Japanese number."),
  "+82": phoneRule(/^\d{8,10}$/, "Enter a valid 8–10 digit South Korean number."),
  "+852": phoneRule(/^\d{8}$/, "Enter a valid 8-digit Hong Kong number."),
  "+60": phoneRule(/^\d{8,10}$/, "Enter a valid 8–10 digit Malaysian number."),
  "+62": phoneRule(/^\d{9,12}$/, "Enter a valid 9–12 digit Indonesian number."),
  "+63": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Philippine number."),
  "+66": phoneRule(/^\d{8,9}$/, "Enter a valid 8–9 digit Thai number."),
  "+84": phoneRule(/^\d{9}$/, "Enter a valid 9-digit Vietnamese number."),
  "+92": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Pakistani number."),
  "+880": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Bangladeshi number."),
  "+94": phoneRule(/^\d{9}$/, "Enter a valid 9-digit Sri Lankan number."),
  "+977": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Nepalese number."),
  "+966": phoneRule(/^\d{8,9}$/, "Enter a valid 8–9 digit Saudi number."),
  "+974": phoneRule(/^\d{8}$/, "Enter a valid 8-digit Qatari number."),
  "+965": phoneRule(/^\d{8}$/, "Enter a valid 8-digit Kuwaiti number."),
  "+973": phoneRule(/^\d{8}$/, "Enter a valid 8-digit Bahraini number."),
  "+968": phoneRule(/^\d{8}$/, "Enter a valid 8-digit Omani number."),
  "+20": phoneRule(/^\d{9,10}$/, "Enter a valid 9–10 digit Egyptian number."),
  "+27": phoneRule(/^\d{9}$/, "Enter a valid 9-digit South African number."),
  "+234": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Nigerian number."),
  "+254": phoneRule(/^\d{9}$/, "Enter a valid 9-digit Kenyan number."),
  "+55": phoneRule(/^\d{10,11}$/, "Enter a valid 10–11 digit Brazilian number."),
  "+52": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Mexican number."),
  "+54": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Argentine number."),
  "+64": phoneRule(/^\d{8,10}$/, "Enter a valid 8–10 digit New Zealand number."),
  "+90": phoneRule(/^\d{10}$/, "Enter a valid 10-digit Turkish number."),
  "+972": phoneRule(/^\d{8,9}$/, "Enter a valid 8–9 digit Israeli number."),
};

/** E.164 national part when the dial code isn't in the map. */
const PHONE_FALLBACK = phoneRule(
  /^\d{6,15}$/,
  "Enter a valid phone number for the selected country.",
);

export function phoneRuleForDialCode(countryCode: string): PhoneRule {
  return PHONE_BY_DIAL[countryCode] ?? PHONE_FALLBACK;
}

/** Digits only — spaces/dashes in a typed number don't fail the country rule. */
export function nationalDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Country-aware phone check for the national-number field next to a dial-code select.
 * Returns an error message, or `undefined` when the number is valid (or empty and
 * not required).
 */
export function phoneErrorForDialCode(
  countryCode: string,
  nationalNumber: string,
  required = true,
): string | undefined {
  const trimmed = nationalNumber.trim();
  if (!trimmed) return required ? "Contact number is required." : undefined;
  const digits = nationalDigits(trimmed);
  const rule = phoneRuleForDialCode(countryCode || "+91");
  if (!rule.pattern.test(digits)) return rule.message;
  return undefined;
}

/** Min 8 chars with lowercase, uppercase, number and symbol. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

/** 15-character GSTIN. */
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

/** 21-character CIN. */
export const CIN_REGEX = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

/** PAN card number, e.g. ABCDE1234F. */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/** Aadhaar number: 12 digits. */
export const AADHAAR_REGEX = /^[0-9]{12}$/;

/** Number of digits in an OTP code. */
export const OTP_LENGTH = 4;

/** OTP delivery channel — same enum the OTP payloads use. */
export type OtpChannel = "EMAIL" | "PHONE";
