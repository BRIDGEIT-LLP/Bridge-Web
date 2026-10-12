"use client";

import { Icon } from "@/components/ui/Icon";

/**
 * One icon button in a table's Actions cell — shared by Admin Management and User
 * Management so both tables' row actions look and behave identically (like `TablePager`).
 * Use it for any future admin table rather than re-inlining the button.
 */
export function RowAction({
  icon,
  label,
  title,
  danger = false,
  disabled = false,
  onClick,
}: {
  /** Material Symbols Outlined icon name. */
  icon: string;
  /** Accessible name, e.g. "Suspend Jane Smith". */
  label: string;
  /** Tooltip text. */
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    // `title` would render the browser's black native tooltip; this is the same styled
    // flyout the deal-room stepper uses. Named group so it doesn't fire on row hover.
    <div className="group/action relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`flex size-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          danger
            ? "text-error hover:bg-error-container/30"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
        }`}
      >
        <Icon name={icon} size={20} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1 w-max scale-95 rounded-lg bg-surface-container-highest px-2.5 py-1.5 text-xs font-medium text-on-surface opacity-0 shadow-lg transition-all duration-150 group-hover/action:scale-100 group-hover/action:opacity-100 group-focus-within/action:scale-100 group-focus-within/action:opacity-100"
      >
        {title}
      </span>
    </div>
  );
}
