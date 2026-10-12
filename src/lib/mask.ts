/**
 * Display-masking helpers for sensitive contact info (phone / email).
 * Shared so the verification screens mask values identically.
 */

/** Mask a phone number, keeping only the last 4 digits visible. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "(+91 ••• ••• 4493)";
  return `••• ••• ${digits.slice(-4)}`;
}

/** Mask an email: first char + dots for the hidden middle + last 4 chars, domain shown. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(j•••@company.com)";
  if (local.length <= 5) return `${local}@${domain}`;
  const hidden = local.length - 5; // 1 first char + 4 last chars revealed
  return `${local[0]}${".".repeat(hidden)}${local.slice(-4)}@${domain}`;
}
