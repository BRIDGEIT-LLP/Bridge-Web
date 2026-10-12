"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { AsyncState } from "@/components/ui/AsyncState";
import {
  ConfirmSaveModal,
  FeatureFlagCard,
  SettingToggleRow,
  SettingsSection,
} from "@/components/dashboard/system-management/SettingsCards";
import { useAuth } from "@/components/auth/AuthProvider";
import { isSuperAdmin } from "@/lib/roles";
import {
  DEFAULT_PLATFORM_FLAGS,
  DEFAULT_TRIAL_SETTINGS,
  fetchOtpConfig,
  fetchPlatformFlags,
  fetchTrialSettings,
  resetOtpConfig,
  updateOtpConfig,
  updatePlatformFlags,
  updateTrialSettings,
} from "@/services/system-management.service";
import type { OtpConfigEntry, PlatformFlags, TrialSettings } from "@/types/api.types";

/**
 * Three independent cards, each with its own GET/PUT pair, its own Edit toggle and its own
 * Reset/Save bar — nothing on this screen saves as a whole. To add, remove or reword a
 * setting, edit the lists below (same idea as `suggestion-weights/page.tsx`'s PARAMETERS).
 *
 * The OTP Configuration card declares nothing here: its fields come from
 * GET /super-admin/config/otp-config (`otp_config_master`), one field per row, labelled
 * with the row's own `lookup` key. Adding a key to that table adds a field to this screen.
 */

/**
 * Display name for every Trial Management field. Both the controls and the confirm dialog's
 * change list read from here, so the two can't drift.
 */
const TRIAL_FIELD_LABELS: Record<keyof TrialSettings, string> = {
  freeTrialDay: "Free Trial Day",
  freeTrialConnectionLimit: "Free Trial connection limit",
  manualExtension: "Manual Extension",
  autoDowngrade: "Auto Downgrade",
  expiryNotification: "Expiry Notifications",
};

/** The three switches in the Trial Management card (labels come from TRIAL_FIELD_LABELS). */
const TRIAL_TOGGLES: { key: keyof TrialSettings; description: string }[] = [
  { key: "manualExtension", description: "Allows support to extend active trials" },
  { key: "autoDowngrade", description: "Move to free tier on expiry" },
  { key: "expiryNotification", description: "Email alerts 48h before end" },
];

/** The feature-flag tiles in the Platform Controls grid. */
const PLATFORM_FLAGS: { key: keyof PlatformFlags; label: string; description: string; icon: string }[] = [
  { key: "maintenanceMode",  label: "Maintenance Mode",  description: "Lock all public access and show status page.", icon: "engineering" },
  { key: "registrationOpen", label: "Registration Open", description: "Allow new users to create accounts.",          icon: "how_to_reg"  },
  { key: "aiMatchingEngine", label: "AI Matching Engine", description: "Rule-based connection matching.",      icon: "memory"      },
  { key: "geoLocationMatching", label: "Geo Location Matching", description: "Factor proximity into match scoring.",  icon: "location_on" },
  { key: "awsS3Storage", label: "AWS S3 Storage", description: "Store files in AWS S3 instead of Azure Blob Storage.", icon: "cloud" },
];

/** Number inputs: empty string → 0 rather than NaN. */
const toNumber = (raw: string) => (raw === "" ? 0 : Number(raw));

/**
 * Field label for one OTP config row: the backend `lookup` with its underscores opened out
 * ("SENT_OTP_TTL" → "SENT OTP TTL"). The key is otherwise untouched so the screen reads as
 * the API's own vocabulary.
 */
const otpLabel = (entry: OtpConfigEntry) => entry.lookup.replace(/_/g, " ");

/* ----- Save confirmation ----- */

/** The cards that save. */
type SectionKey = "otp" | "trial" | "flags";

/** Every action that goes through the confirm dialog — the three saves plus the OTP reset. */
type ConfirmKey = SectionKey | "otpReset";

/**
 * Copy for each confirmable action. The description says what the action *does* — these
 * settings apply platform-wide the moment the request lands, so the dialog is the last stop.
 */
const CONFIRM_COPY: Record<
  ConfirmKey,
  { title: string; description: string; confirmLabel?: string; busyLabel?: string }
> = {
  otp: {
    title: "Update OTP configuration?",
    description:
      "These values apply to every OTP the platform sends from now on. Codes already issued keep the settings they were sent with until they expire.",
  },
  trial: {
    title: "Update trial settings?",
    description:
      "Trial length, connection limits and the automated trial emails will follow these values for every trial that runs after the update.",
  },
  flags: {
    title: "Update platform controls?",
    description:
      "Feature flags take effect platform-wide as soon as they're saved and change what every signed-in user can do.",
  },
  otpReset: {
    title: "Reset OTP configuration?",
    description:
      "Every OTP setting goes back to its shipped default value, including any you didn't change. This can't be undone from here — the previous values aren't kept.",
    confirmLabel: "Reset",
    busyLabel: "Resetting…",
  },
};

/** One "Field → new value" line in the confirm dialog's change list. */
const changeLine = (label: string, value: string | number | boolean) =>
  `${label} → ${typeof value === "boolean" ? (value ? "On" : "Off") : value}`;

/* ----- Per-section edit state ----- */

interface SectionEditor<T> {
  /** Working copy — what the controls render and mutate. */
  value: T;
  setValue: React.Dispatch<React.SetStateAction<T>>;
  /** Last fetched/saved snapshot — the dirty baseline and the discard target. */
  saved: T;
  /** Set both copies at once (initial load, and after a successful save). */
  hydrate: (next: T) => void;
  editing: boolean;
  toggleEdit: (next: boolean) => void;
  dirty: boolean;
  saving: boolean;
  setSaving: (v: boolean) => void;
}

/**
 * Edit/dirty/save bookkeeping for one card. Each card holds its own instance, so toggling
 * or saving one never touches another.
 */
function useSectionEditor<T>(initialValue: T): SectionEditor<T> {
  const [value, setValue] = useState<T>(initialValue);
  const [saved, setSaved] = useState<T>(initialValue);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  const hydrate = useCallback((next: T) => {
    setValue(next);
    setSaved(next);
  }, []);

  /** Leaving edit mode discards anything unsaved, so nothing pending hides behind a
   *  read-only card. */
  const toggleEdit = (next: boolean) => {
    setEditing(next);
    if (!next && dirty) {
      setValue(saved);
      toast.info("Unsaved changes were discarded.");
    }
  };

  return { value, setValue, saved, hydrate, editing, toggleEdit, dirty, saving, setSaving };
}

export default function SystemManagementPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const otp = useSectionEditor<OtpConfigEntry[]>([]);
  const trial = useSectionEditor<TrialSettings>(DEFAULT_TRIAL_SETTINGS);
  const flags = useSectionEditor<PlatformFlags>(DEFAULT_PLATFORM_FLAGS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Which action's "are you sure?" dialog is open — null when none is. */
  const [pending, setPending] = useState<ConfirmKey | null>(null);

  useEffect(() => {
    if (isLoaded && !isSuperAdmin(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const { hydrate: hydrateOtp } = otp;
  const { hydrate: hydrateTrial } = trial;
  const { hydrate: hydrateFlags } = flags;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Each card has its own endpoint, so they're fetched independently — the two
    // placeholder endpoints 404ing can't blank out the live OTP config.
    const [otpResult, trialResult, flagsResult] = await Promise.allSettled([
      fetchOtpConfig(),
      fetchTrialSettings(),
      fetchPlatformFlags(),
    ]);

    if (otpResult.status === "fulfilled") {
      hydrateOtp(otpResult.value);
    } else {
      setError(
        otpResult.reason instanceof Error
          ? otpResult.reason.message
          : "Couldn't load the OTP configuration."
      );
    }

    // Trial + flags don't have endpoints yet, so a failure falls back to the shipped
    // defaults. DELETE these fallbacks once those endpoints are live — surfacing the
    // error the way the OTP card does is the correct behaviour then.
    hydrateTrial(trialResult.status === "fulfilled" ? trialResult.value : DEFAULT_TRIAL_SETTINGS);
    hydrateFlags(flagsResult.status === "fulfilled" ? flagsResult.value : DEFAULT_PLATFORM_FLAGS);

    setLoading(false);
  }, [hydrateOtp, hydrateTrial, hydrateFlags]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Save one card: PUT, adopt the values as the new baseline, report either way. Resolves to
   * whether it succeeded, so the confirm dialog stays open (with the values intact) on failure.
   */
  async function saveSection<T>(section: SectionEditor<T>, put: () => Promise<void>, label: string) {
    section.setSaving(true);
    try {
      await put();
      section.hydrate(section.value);
      toast.success(`${label} saved.`);
      return true;
    } catch {
      toast.error(`Couldn't save the ${label.toLowerCase()}. Please try again.`);
      return false;
    } finally {
      section.setSaving(false);
    }
  }

  /* ----- OTP Configuration ----- */

  /** Update one OTP config row by its backend `lookup` key. */
  const setOtpValue = (lookup: string, value: string) => {
    otp.setValue((prev) => prev.map((row) => (row.lookup === lookup ? { ...row, value } : row)));
  };

  /** Only the rows whose value the user actually touched — the PUT is a partial update. */
  const otpChanges = otp.value.reduce<Record<string, string>>((acc, row) => {
    const before = otp.saved.find((r) => r.lookup === row.lookup);
    if (before && before.value !== row.value) acc[row.lookup] = row.value;
    return acc;
  }, {});

  /** Save asks first — the PUT only runs from the confirm dialog's Update button. */
  const handleOtpSave = () => {
    // A blank value would be written to the column verbatim, so stop before the dialog.
    const blank = otp.value.find((row) => !row.value.trim());
    if (blank) {
      toast.error(`${otpLabel(blank)} can't be empty.`);
      return;
    }
    setPending("otp");
  };

  /**
   * Reset all OTP config rows to their DB default_value. Runs only from the confirm dialog.
   * Calls PUT /super-admin/config/otp-config/reset, then re-fetches fresh values
   * from the DB so the UI reflects exactly what was written.
   */
  const handleOtpReset = async () => {
    otp.setSaving(true);

    // Only the write decides success/failure. Re-reading is a second request that can fail on
    // its own, and folding it into one try/catch would report an applied reset as a failure —
    // the dialog would stay open asking the user to retry a change the DB already took.
    try {
      await resetOtpConfig();
    } catch {
      toast.error("Couldn't reset the OTP configuration. Please try again.");
      otp.setSaving(false);
      return false;
    }

    try {
      otp.hydrate(await fetchOtpConfig());
      toast.success("OTP configuration reset to defaults.");
    } catch {
      // Reset landed; only the read-back didn't, so the card is showing stale values.
      toast.success("OTP configuration reset to defaults. Reload to see the new values.");
    } finally {
      otp.setSaving(false);
    }

    return true;
  };

  /* ----- Trial Management ----- */

  const setTrial = <K extends keyof TrialSettings>(key: K, value: TrialSettings[K]) => {
    trial.setValue((prev) => ({ ...prev, [key]: value }));
  };

  /** Only the fields the user actually changed — the PUT is a partial update. */
  const trialChanges = (Object.keys(trial.value) as (keyof TrialSettings)[]).reduce<
    Partial<TrialSettings>
  >((acc, key) => {
    if (trial.value[key] !== trial.saved[key]) {
      // Assigning through a mapped key needs the cast; the types line up by construction.
      (acc[key] as TrialSettings[typeof key]) = trial.value[key];
    }
    return acc;
  }, {});

  /* ----- Platform Controls ----- */

  const setFlag = <K extends keyof PlatformFlags>(key: K, value: PlatformFlags[K]) => {
    flags.setValue((prev) => ({ ...prev, [key]: value }));
  };
  const flagChanges = PLATFORM_FLAGS.reduce<Partial<PlatformFlags>>((acc, { key }) => {
    if (flags.value[key] !== flags.saved[key]) acc[key] = flags.value[key];
    return acc;
  }, {});

  /* ----- Confirm-then-save ----- */

  /**
   * Everything the confirm dialog needs, per action: the editor (for its `saving` flag), the
   * "Field → new value" lines it lists, and the request to run once the user confirms.
   */
  const sections: Record<
    ConfirmKey,
    { editor: SectionEditor<unknown>; changes: string[]; save: () => Promise<boolean> }
  > = {
    otp: {
      editor: otp as SectionEditor<unknown>,
      changes: Object.entries(otpChanges).map(([lookup, value]) =>
        changeLine(lookup.replace(/_/g, " "), value)
      ),
      save: () => saveSection(otp, () => updateOtpConfig(otpChanges), "OTP configuration"),
    },
    trial: {
      editor: trial as SectionEditor<unknown>,
      changes: (Object.keys(trialChanges) as (keyof TrialSettings)[]).map((key) =>
        changeLine(TRIAL_FIELD_LABELS[key], trial.value[key])
      ),
      save: () => saveSection(trial, () => updateTrialSettings(trialChanges), "Trial settings"),
    },
    flags: {
      editor: flags as SectionEditor<unknown>,
      changes: PLATFORM_FLAGS.filter((f) => flags.value[f.key] !== flags.saved[f.key]).map((f) =>
        changeLine(f.label, flags.value[f.key])
      ),
      save: () => saveSection(flags, () => updatePlatformFlags(flagChanges), "Platform controls"),
    },
    // Reset compares against each row's own default_value, not the edited working copy —
    // it lists what the DB will actually change, including rows the user never touched.
    otpReset: {
      editor: otp as SectionEditor<unknown>,
      changes: otp.saved
        .filter((row) => row.value !== row.defaultValue)
        .map((row) => changeLine(otpLabel(row), row.defaultValue)),
      save: handleOtpReset,
    },
  };

  const active = pending ? sections[pending] : null;

  /** Run the pending card's PUT; a failure keeps the dialog open so it can be retried. */
  const handleConfirmSave = async () => {
    if (!active) return;
    if (await active.save()) setPending(null);
  };

  if (!isLoaded || !isSuperAdmin(role)) return null;

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6 md:px-8">
      <div className="mb-8">
        <h1 className="mb-2 font-headline text-3xl font-bold tracking-[-0.02em] text-on-surface md:text-4xl">
          System Management
        </h1>
        <p className="max-w-2xl text-on-surface-variant">
          Manage platform-wide configuration, security protocols, and trial behaviors across the
          BridgeConnect ecosystem.
        </p>
      </div>

      <AsyncState loading={loading} error={error} onRetry={load}>
        <div className="space-y-8">
          {/* OTP Configuration — one field per `otp_config_master` row, labelled with the
              row's own backend `lookup` key so the screen and the API never drift. */}
          <SettingsSection
            icon="key"
            title="OTP Configuration"
            description="Multi-factor authentication gateway settings"
            editing={otp.editing}
            onEditChange={otp.toggleEdit}
            dirty={otp.dirty}
            saving={otp.saving}
            onSave={handleOtpSave}
            onReset={() => setPending("otpReset")}
          >
            {otp.value.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No OTP configuration keys were returned.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-3">
                {otp.value.map((entry) => (
                  <Input
                    key={entry.lookup}
                    id={`otp-${entry.lookup}`}
                    variant="underline"
                    label={otpLabel(entry)}
                    value={entry.value}
                    onChange={(e) => setOtpValue(entry.lookup, e.target.value)}
                    {...(entry.dataType === "integer"
                      ? { type: "number" as const, min: 0 }
                      : { type: "text" as const })}
                    disabled={!otp.editing}
                  />
                ))}
              </div>
            )}
          </SettingsSection>

          {/* Trial Management */}
          <SettingsSection
            icon="timer"
            title="Trial Management"
            description="Control user onboarding and conversion windows"
            editing={trial.editing}
            onEditChange={trial.toggleEdit}
            dirty={trial.dirty}
            saving={trial.saving}
            onSave={() => setPending("trial")}
          >
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
              <div className="space-y-6 rounded-lg bg-surface-container-low p-6">
                <Input
                  id="trial-duration"
                  variant="underline"
                  type="number"
                  min={0}
                  label={TRIAL_FIELD_LABELS.freeTrialDay}
                  value={trial.value.freeTrialDay}
                  onChange={(e) => setTrial("freeTrialDay", toNumber(e.target.value))}
                  disabled={!trial.editing}
                />
                <Input
                  id="trial-max-extension"
                  variant="underline"
                  type="number"
                  min={0}
                  label={TRIAL_FIELD_LABELS.freeTrialConnectionLimit}
                  value={trial.value.freeTrialConnectionLimit}
                  onChange={(e) => setTrial("freeTrialConnectionLimit", toNumber(e.target.value))}
                  disabled={!trial.editing}
                />
              </div>

              <div className="space-y-6">
                {TRIAL_TOGGLES.map((toggle, i) => (
                  <SettingToggleRow
                    key={toggle.key}
                    label={TRIAL_FIELD_LABELS[toggle.key]}
                    description={toggle.description}
                    divider={i < TRIAL_TOGGLES.length - 1}
                    checked={trial.value[toggle.key] as boolean}
                    onChange={(v) => setTrial(toggle.key, v)}
                    disabled={!trial.editing}
                  />
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* Platform Controls */}
          <SettingsSection
            icon="settings_suggest"
            title="Platform Controls"
            description="Global feature flags and operational state"
            editing={flags.editing}
            onEditChange={flags.toggleEdit}
            dirty={flags.dirty}
            saving={flags.saving}
            onSave={() => setPending("flags")}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_FLAGS.map((flag) => (
                <FeatureFlagCard
                  key={flag.key}
                  icon={flag.icon}
                  label={flag.label}
                  description={flag.description}
                  checked={flags.value[flag.key]}
                  onChange={(v) => setFlag(flag.key, v)}
                  disabled={!flags.editing}
                />
              ))}
            </div>
          </SettingsSection>
        </div>
      </AsyncState>

      {/* One confirm dialog for all three cards — nothing on this screen PUTs without it. */}
      <ConfirmSaveModal
        open={pending !== null}
        title={pending ? CONFIRM_COPY[pending].title : ""}
        description={pending ? CONFIRM_COPY[pending].description : ""}
        changes={active?.changes}
        saving={active?.editor.saving ?? false}
        confirmLabel={pending ? CONFIRM_COPY[pending].confirmLabel : undefined}
        busyLabel={pending ? CONFIRM_COPY[pending].busyLabel : undefined}
        onCancel={() => setPending(null)}
        onConfirm={() => void handleConfirmSave()}
      />
    </div>
  );
}
