"use client";

import React from "react";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";

/**
 * The building blocks of the System Management screen. They're only ever used
 * together, so they share a file (same idea as `dashboard/kyc-status.tsx`):
 *   SettingsSection  — the card shell: tonal icon header, its own Edit toggle, and its
 *                      own Reset/Save bar (each card saves to its own endpoint)
 *   SettingToggleRow — label/description left, switch right
 *   FeatureFlagCard  — one tile in the Platform Controls grid
 *   ConfirmSaveModal — the "are you sure?" step every card's Save goes through
 */

interface SettingsSectionProps {
  /** Material Symbols Outlined icon shown in the tonal tile. */
  icon: string;
  title: string;
  description: string;
  /** Optional slot left of the Edit toggle (e.g. a stats chip). */
  action?: React.ReactNode;
  /** This card's own edit mode — every card on the screen toggles independently. */
  editing: boolean;
  onEditChange: (v: boolean) => void;
  /** Enables Save — this card has unsaved changes. */
  dirty: boolean;
  /** This card's save is in flight. */
  saving: boolean;
  onSave: () => void;
  /** Omit to hide the Reset Defaults button — only cards with a meaningful shipped
   *  default offer one. */
  onReset?: () => void;
  children: React.ReactNode;
}

/**
 * One System Management card: tonal icon tile + title/description and an Edit toggle, its
 * controls, then a Reset/Save bar while editing. Each card is self-contained because each
 * one is backed by a separate GET/PUT pair.
 */
export function SettingsSection({
  icon,
  title,
  description,
  action,
  editing,
  onEditChange,
  dirty,
  saving,
  onSave,
  onReset,
  children,
}: SettingsSectionProps) {
  return (
    <Card surface="lowest" ambient={false} padding="none" className="border border-outline-variant/20 p-6 md:p-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Icon name={icon} size={24} />
          </span>
          <div>
            <h2 className="font-headline text-xl font-semibold text-on-surface">{title}</h2>
            <p className="text-sm text-on-surface-variant">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {action}
          <ToggleSwitch
            checked={editing}
            onChange={onEditChange}
            label={editing ? "Editing" : "Edit"}
            disabled={saving}
          />
        </div>
      </header>

      {children}

      {editing && (
        // Compact actions: `Button` ships at h-12/text-base, which is CTA-sized and too
        // heavy for a per-card footer, so both are stepped down to h-10/text-sm together.
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {onReset && (
            <Button variant="ghost" onClick={onReset} disabled={saving} className="h-10 px-4 text-sm">
              Reset Defaults
            </Button>
          )}
          <Button variant="primary" onClick={onSave} disabled={!dirty || saving} className="h-10 px-5 text-sm">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}
    </Card>
  );
}

interface SettingToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Draw the hairline rule underneath (used between stacked rows). */
  divider?: boolean;
  /** Read-only (the screen isn't in edit mode). */
  disabled?: boolean;
}

/** Label + description on the left, switch on the right (Trial toggles + OTP sandbox mode). */
export function SettingToggleRow({ label, description, checked, onChange, divider = false, disabled = false }: SettingToggleRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        divider ? "border-b border-outline-variant/20 pb-4" : ""
      }`}
    >
      <div>
        <span className="text-sm font-semibold text-on-surface">{label}</span>
        <p className="text-xs text-on-surface-variant">{description}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} label={label} hideLabel disabled={disabled} />
    </div>
  );
}

interface FeatureFlagCardProps {
  /** Material Symbols Outlined icon name. */
  icon: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Read-only (the screen isn't in edit mode). */
  disabled?: boolean;
}

interface ConfirmSaveModalProps {
  open: boolean;
  /** e.g. "Update OTP configuration?" */
  title: string;
  /** What saving actually does — the consequence, not a restatement of the title. */
  description: string;
  /** Human-readable names of the settings about to change, listed for review. */
  changes?: string[];
  /** The PUT is in flight — both buttons lock. */
  saving: boolean;
  /** Confirm button label — "Update" for a save, "Reset" for a reset-to-defaults. */
  confirmLabel?: string;
  /** Confirm button label while the request is in flight. */
  busyLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * The confirm step between a card's action button ("Save Changes" / "Reset Defaults") and the
 * request it fires. Same dialog shape as the Admin Management suspend/reactivate confirm,
 * minus the reason field — these settings aren't audited per-change, so there's nothing to
 * collect; the user only has to acknowledge that the change is about to go live.
 */
export function ConfirmSaveModal({
  open,
  title,
  description,
  changes = [],
  saving,
  confirmLabel = "Update",
  busyLabel = "Saving…",
  onCancel,
  onConfirm,
}: ConfirmSaveModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeDisabled={saving}
      title={title}
      maxWidthClass="max-w-md"
      bodyClassName="p-4 sm:p-6"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex h-11 items-center rounded-xl px-5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim disabled:opacity-50"
          >
            {saving ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-on-surface-variant">{description}</p>

        {/* Exactly what's about to change — the cards are read-only until Edit is on, so this
            is the last chance to catch a stray toggle before it goes platform-wide. */}
        {changes.length > 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
            {/* Uppercase micro-label: `tracking-wide`, not the tight tracking used elsewhere —
                at 10–12px the tight setting closes the gap after the count ("1CHANGE"). */}
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              {changes.length === 1 ? "1 change" : `${changes.length} changes`}
            </p>
            <ul className="space-y-1.5">
              {changes.map((label) => (
                <li key={label} className="flex items-start gap-2 text-sm text-on-surface">
                  <Icon name="edit" size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
                  <span className="min-w-0 break-words">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** One tile in the Platform Controls grid: icon + compact switch above the copy. */
export function FeatureFlagCard({ icon, label, description, checked, onChange, disabled = false }: FeatureFlagCardProps) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-6 transition-colors">
      <div className="mb-4 flex items-start justify-between">
        <Icon name={icon} size={24} className="text-surface-tint" />
        <ToggleSwitch checked={checked} onChange={onChange} label={label} hideLabel size="sm" disabled={disabled} />
      </div>
      <h3 className="mb-1 text-sm font-bold text-on-surface">{label}</h3>
      <p className="text-xs text-on-surface-variant">{description}</p>
    </div>
  );
}
