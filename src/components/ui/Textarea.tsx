import React, { forwardRef } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Show a red `*` after the label (mandatory field). */
  required?: boolean;
  /** Show a blue "Optional" after the label (non-mandatory field). */
  optional?: boolean;
  /** Show a "Recommended" hint after the label (encouraged, not mandatory). */
  recommended?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, required, optional, recommended, className = "", id, rows = 3, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label
            htmlFor={id}
            className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant"
          >
            {label}
            {required && <span className="align-middle text-base leading-none text-error"> *</span>}
            {optional && <span className="font-medium normal-case text-primary"> (Optional)</span>}
            {recommended && <span className="font-medium normal-case text-primary"> (Recommended)</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={`w-full resize-none rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2.5 text-sm text-on-surface transition-all duration-200 placeholder:text-outline-variant hover:border-outline-variant/60 focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/10 ${error ? "border-error/80 ring-2 ring-error/10" : ""} ${className}`}
          {...props}
        />
        {error && <span className="px-1 text-xs font-medium text-error">{error}</span>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
