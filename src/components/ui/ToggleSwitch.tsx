"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Visible text next to the switch — becomes the accessible name only when `hideLabel`. */
  label: string;
  /** Render just the track/thumb (the row/card supplies its own visible label). */
  hideLabel?: boolean;
  /** Track size — `sm` is the compact switch used on the feature-flag cards. */
  size?: "sm" | "md";
  id?: string;
  disabled?: boolean;
}

// Both sizes travel the same 20px (track − thumb − 2×inset), so only the box changes.
const trackClasses = { sm: "h-5 w-10", md: "h-6 w-11" };
const thumbClasses = { sm: "size-4", md: "size-5" };

/** Labeled track/thumb switch — used for "View ↔ Edit" toggles (Profile page, Meeting
 *  Details modal) and, with `hideLabel`, for every System Management setting row. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  hideLabel = false,
  size = "md",
  id,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-2.5 select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {!hideLabel && <span className="text-sm font-semibold text-on-surface-variant">{label}</span>}
      {/* Track */}
      <span
        className={`relative flex shrink-0 items-center rounded-full transition-colors duration-200 ${trackClasses[size]} ${
          checked ? "bg-primary" : "bg-outline-variant/60"
        }`}
      >
        {/* Thumb */}
        <span
          className={`absolute left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${thumbClasses[size]} ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
