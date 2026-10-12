"use client";

import { Icon } from "@/components/ui/Icon";

interface SelectableOptionRowProps {
  /** Material Symbols Outlined icon name. */
  icon: string;
  title: string;
  /** Secondary line (masked contact, role description, …). */
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * One selectable option row: leading icon tile, title + subtitle, trailing
 * radio/check indicator, with a primary ring when selected. Shared by the login
 * MFA channel picker and the dashboard "Switch User" modal so the selectable-row
 * styling lives in one place.
 */
export function SelectableOptionRow({
  icon,
  title,
  subtitle,
  selected,
  onSelect,
  disabled = false,
}: SelectableOptionRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-primary bg-primary-container/40 ring-2 ring-primary/15"
          : "border-outline-variant/30 bg-surface-container-low hover:border-outline-variant/60"
      }`}
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
          selected ? "bg-primary text-on-primary" : "bg-surface-container-highest text-primary"
        }`}
      >
        <Icon name={icon} size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-on-surface">{title}</p>
        {subtitle && <p className="truncate text-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      <Icon
        name={selected ? "check_circle" : "radio_button_unchecked"}
        size={22}
        className={selected ? "text-primary" : "text-outline-variant"}
      />
    </button>
  );
}
