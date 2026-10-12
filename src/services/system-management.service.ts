import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type { OtpConfigEntry, PlatformFlags, TrialSettings } from "@/types/api.types";

/**
 * Super Admin → System Management data.
 *
 * The screen is three independent cards, and this file mirrors that: one fetch/update pair
 * per section, each against its own endpoint. A section's failure never affects the others.
 *
 *   OTP Configuration  — LIVE   (`SUPER_ADMIN_OTP_CONFIG`)
 *   Trial Management   — placeholder endpoint
 *   Platform Controls  — placeholder endpoint
 *
 * For the two placeholders, when the real curl arrives this is the ONLY file that changes —
 * the page and its components never see a backend key:
 *   1. point the constant (config/constant.ts) at the real path;
 *   2. rename the raw keys read in the `to*` mapper and written in the `to*Payload` mapper.
 * Every read is defaulted, so a partial or differently-shaped response degrades to the
 * shipped defaults instead of crashing the screen. The access token is attached by the
 * axios interceptor.
 */

/* ----- Shared coercion helpers ----- */

/** Coerce anything number-ish to a number, falling back to the shipped default. */
function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce anything boolean-ish ("true"/1/true) to a boolean, defaulted. */
function bool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return Boolean(value);
}

/* ----- OTP Configuration (LIVE: /super-admin/config/otp-config) ----- */

/**
 * The endpoint returns the `otp_config_master` rows as-is, so the mapper only camel-cases
 * the column names — `lookup` stays untouched and is what the UI renders as each field's
 * label, and is the key the PUT body is built from.
 */
function toOtpConfigEntry(raw: Record<string, unknown>): OtpConfigEntry {
  return {
    id: Number(raw.id),
    lookup: String(raw.lookup ?? ""),
    value: raw.value == null ? "" : String(raw.value),
    defaultValue: raw.default_value == null ? "" : String(raw.default_value),
    dataType: String(raw.data_type ?? "integer"),
    unit: String(raw.unit ?? ""),
    description: (raw.description as string | null) ?? undefined,
    updatedAt: (raw.updated_at as string | null) ?? undefined,
  };
}

/**
 * Fetch every OTP config row. The response is `{ success, message, data: [...] }`; a
 * non-array `data` degrades to an empty list so the card renders its empty state rather
 * than crashing the screen.
 */
export async function fetchOtpConfig(): Promise<OtpConfigEntry[]> {
  const { data } = await api.get(API_ENDPOINTS.SUPER_ADMIN_OTP_CONFIG);
  const rows = data?.data ?? data;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => toOtpConfigEntry(row as Record<string, unknown>)).filter((e) => e.lookup);
}

/**
 * Save changed OTP config rows. The body is keyed by `lookup` — `{ otpConfig: { SENT_OTP_TTL:
 * "180", … } }` — which the backend feeds through `jsonb_each_text`, so only the keys sent
 * are touched. Values go as strings (the column is a varchar). The response carries no body.
 */
export async function updateOtpConfig(updates: Record<string, string>): Promise<void> {
  await api.put(API_ENDPOINTS.SUPER_ADMIN_OTP_CONFIG, { otpConfig: updates });
}

/* ----- Trial Management (LIVE: /super-admin/config/trial-config) ----- */
/**
 * Reset all OTP config rows to their `default_value` in the DB.
 * PUT /super-admin/config/otp-config/reset — no body required.
 * After the reset, call fetchOtpConfig() to re-hydrate the UI with the fresh DB values.
 */
export async function resetOtpConfig(): Promise<void> {
  await api.put(API_ENDPOINTS.SUPER_ADMIN_OTP_CONFIG_RESET);
}

/* ----- Trial Management (placeholder endpoint) ----- */

/** Our field name → the backend's `trialConfig` key. The single mapping for both directions. */
const TRIAL_KEYS: Record<keyof TrialSettings, string> = {
  freeTrialDay: "free_trial_day",
  freeTrialConnectionLimit: "free_trial_connection_limit",
  manualExtension: "manual_extension",
  autoDowngrade: "auto_downgrade",
  expiryNotification: "expiry_notification",
};

/** Shipped trial values — the fallback for any field the response omits. */
export const DEFAULT_TRIAL_SETTINGS: TrialSettings = {
  freeTrialDay: 7,
  freeTrialConnectionLimit: 3,
  manualExtension: true,
  autoDowngrade: true,
  expiryNotification: true,
};

/**
 * Accepts either shape the config endpoints use: a flat `{ free_trial_day: 14, … }`
 * object, or `otp-config`-style rows `[{ lookup, value }]`. Both collapse to one lookup
 * table before being read, so whichever the backend settles on works unchanged.
 */
function flattenConfig(raw: unknown): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      const row = entry as Record<string, unknown>;
      if (row?.lookup) flat[String(row.lookup)] = row.value;
    });
  } else if (raw && typeof raw === "object") {
    Object.assign(flat, raw as Record<string, unknown>);
  }
  return flat;
}

export function toTrialSettings(raw: unknown): TrialSettings {
  const flat = flattenConfig(raw);
  const d = DEFAULT_TRIAL_SETTINGS;
  return {
    freeTrialDay: num(flat[TRIAL_KEYS.freeTrialDay], d.freeTrialDay),
    freeTrialConnectionLimit: num(
      flat[TRIAL_KEYS.freeTrialConnectionLimit],
      d.freeTrialConnectionLimit
    ),
    manualExtension: bool(flat[TRIAL_KEYS.manualExtension], d.manualExtension),
    autoDowngrade: bool(flat[TRIAL_KEYS.autoDowngrade], d.autoDowngrade),
    expiryNotification: bool(flat[TRIAL_KEYS.expiryNotification], d.expiryNotification),
  };
}

export async function fetchTrialSettings(): Promise<TrialSettings> {
  const { data } = await api.get(API_ENDPOINTS.SUPER_ADMIN_TRIAL_CONFIG);
  return toTrialSettings(data?.data ?? data ?? {});
}

/**
 * Save trial config. Takes ONLY the changed fields — the caller diffs against the last
 * saved snapshot — and wraps them exactly as the endpoint expects:
 *
 *   { "trialConfig": { "free_trial_day": 14, "manual_extension": true } }
 *
 * Values keep their native types (number / boolean), not strings.
 */
export async function updateTrialSettings(changes: Partial<TrialSettings>): Promise<void> {
  const trialConfig: Record<string, number | boolean> = {};
  (Object.keys(changes) as (keyof TrialSettings)[]).forEach((key) => {
    const value = changes[key];
    if (value !== undefined) trialConfig[TRIAL_KEYS[key]] = value;
  });

  await api.put(API_ENDPOINTS.SUPER_ADMIN_TRIAL_CONFIG, { trialConfig });
}

/* ----- Platform Controls (mixed: placeholder endpoint + live trial-config) ----- */
const AWS_STORAGE_LOOKUP = "aws_service_enabled";

/** Shipped feature-flag state — the fallback and the "Reset Defaults" target. */
export const DEFAULT_PLATFORM_FLAGS: PlatformFlags = {
  maintenanceMode: false,
  registrationOpen: true,
  aiMatchingEngine: true,
  geoLocationMatching: true,
  awsS3Storage: false,
};

/** Our field name → the backend's `platform-flags` key. `awsS3Storage` goes to trial-config. */
const FLAG_KEYS: Record<keyof Omit<PlatformFlags, "awsS3Storage">, string> = {
  maintenanceMode: "maintenance_mode",
  registrationOpen: "registration_open",
  aiMatchingEngine: "ai_matching_engine",
  geoLocationMatching: "geo_location_matching",
};

export function toPlatformFlags(raw: Record<string, unknown>): PlatformFlags {
  const d = DEFAULT_PLATFORM_FLAGS;
  return {
    maintenanceMode: bool(raw.maintenance_mode, d.maintenanceMode),
    registrationOpen: bool(raw.registration_open, d.registrationOpen),
    aiMatchingEngine: bool(raw.ai_matching_engine, d.aiMatchingEngine),
    geoLocationMatching: bool(raw.geo_location_matching, d.geoLocationMatching),
    awsS3Storage: bool(raw[AWS_STORAGE_LOOKUP], d.awsS3Storage),
  };
}

/** Only the changed keys, so the PUT stays a partial update like the other two cards. */
function toPlatformFlagsPayload(changes: Partial<PlatformFlags>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  (Object.keys(FLAG_KEYS) as (keyof typeof FLAG_KEYS)[]).forEach((key) => {
    if (changes[key] !== undefined) payload[FLAG_KEYS[key]] = changes[key];
  });
  return payload;
}

/** The live AWS S3 Storage flag, read out of the trial-config rows. */
async function fetchAwsS3StorageFlag(): Promise<boolean> {
  const { data } = await api.get(API_ENDPOINTS.SUPER_ADMIN_TRIAL_CONFIG);
  const flat = flattenConfig(data?.data ?? data ?? {});
  return bool(flat[AWS_STORAGE_LOOKUP], DEFAULT_PLATFORM_FLAGS.awsS3Storage);
}

export async function fetchPlatformFlags(): Promise<PlatformFlags> {
  // Settled, not awaited together: the placeholder endpoint 404ing must not blank out the
  // live AWS flag, and vice versa.
  const [placeholder, aws] = await Promise.allSettled([
    api.get(API_ENDPOINTS.SUPER_ADMIN_PLATFORM_FLAGS),
    fetchAwsS3StorageFlag(),
  ]);

  const raw =
    placeholder.status === "fulfilled"
      ? ((placeholder.value.data?.data ?? placeholder.value.data ?? {}) as Record<string, unknown>)
      : {};

  return {
    ...toPlatformFlags(raw),
    awsS3Storage: aws.status === "fulfilled" ? aws.value : DEFAULT_PLATFORM_FLAGS.awsS3Storage,
  };
}

export async function updatePlatformFlags(changes: Partial<PlatformFlags>): Promise<void> {
  if (changes.awsS3Storage !== undefined) {
    await api.put(API_ENDPOINTS.SUPER_ADMIN_TRIAL_CONFIG, {
      trialConfig: { [AWS_STORAGE_LOOKUP]: changes.awsS3Storage },
    });
  }

  const payload = toPlatformFlagsPayload(changes);
  if (Object.keys(payload).length > 0) {
    await api.put(API_ENDPOINTS.SUPER_ADMIN_PLATFORM_FLAGS, payload);
  }
}