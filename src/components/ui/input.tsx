import React, { forwardRef } from "react";

/**
 * Field chrome shared by `Input` and `Select` (which imports these) so the two never
 * duplicate class strings:
 * - `filled` — the boxed field used across onboarding and the admin tables (default).
 * - `underline` — the editorial bottom-rule field from the Super Admin panel design.
 * Height is set by each caller (Select's multi-select grows).
 */
export const FIELD_STYLES = {
  filled: {
    control:
      "rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 hover:border-outline-variant/60 focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/10",
    label: "px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant",
    error: "border-error/80 ring-2 ring-error/10",
  },
  underline: {
    control:
      "rounded-none border-0 border-b border-outline-variant bg-transparent px-0 font-medium hover:border-outline focus:border-surface-tint focus:ring-0",
    label: "font-label text-[11px] font-bold uppercase tracking-wider text-on-secondary-container",
    error: "border-b-error",
  },
} as const;

export type FieldVariant = keyof typeof FIELD_STYLES;

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  type?: React.HTMLInputTypeAttribute;
  label?: string;
  error?: string;
  /** Show a red `*` after the label (mandatory field). */
  required?: boolean;
  /** Show a blue "Optional" after the label (non-mandatory field). */
  optional?: boolean;
  /** Show a "Recommended" hint after the label (encouraged, not mandatory). */
  recommended?: boolean;
  /** Trailing adornment (icon/button), absolutely positioned at right-4. */
  adornment?: React.ReactNode;
  /** Classes for the adornment wrapper; overrides the default muted color. */
  adornmentClassName?: string;
  variant?: FieldVariant;
}

/**
 * Filled input matching the Stitch screens: h-14, bg-surface-container-highest,
 * borderless, rounded-xl, primary focus ring. Uppercase bold label above.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, optional, recommended, adornment, adornmentClassName, variant = "filled", type = "text", className = "", id, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label htmlFor={id} className={FIELD_STYLES[variant].label}>
            {label}
            {required && <span className="align-middle text-base leading-none text-error"> *</span>}
            {optional && <span className="font-medium normal-case text-primary"> (Optional)</span>}
            {recommended && <span className="font-medium normal-case text-primary"> (Recommended)</span>}
          </label>
        )}
        <div className="group relative">
          <input
            ref={ref}
            id={id}
            type={type}
            className={`h-10 w-full text-sm text-on-surface transition-all duration-200 placeholder:text-outline-variant focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
              FIELD_STYLES[variant].control
            } ${error ? FIELD_STYLES[variant].error : ""} ${adornment ? "pr-10" : ""} ${className}`}
            {...props}
          />
          {adornment && (
            <div
              className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center ${
                adornmentClassName ?? "text-on-surface-variant"
              }`}
            >
              {adornment}
            </div>
          )}
        </div>
        {error && <span className="px-1 text-xs font-medium text-error">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
