"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { FIELD_STYLES, type FieldVariant } from "@/components/ui/input";
import type { Option } from "@/lib/startup-profile-options";

interface BaseProps {
  label?: string;
  error?: string;
  placeholder?: string;
  options: Option[];
  id?: string;
  disabled?: boolean;
  /** Enforce a selection via native form validation + show a red `*`. */
  required?: boolean;
  /** Show a blue "Optional" after the label (non-mandatory field). */
  optional?: boolean;
  /** Show a "Recommended" hint after the label (encouraged, not mandatory). */
  recommended?: boolean;
  /** Show a search box in the panel. Defaults to true when options.length > 6. */
  searchable?: boolean;
  /** Field chrome — see `field-variants.ts`. Ignored when `className` is supplied. */
  variant?: FieldVariant;
  "aria-label"?: string;
  className?: string;
  panelClassName?: string;
  displayValueOnly?: boolean;
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultiProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type SelectProps = SingleProps | MultiProps;

/**
 * Input-styled dropdown with a popover list of rows. Single-select shows the
 * chosen label and closes on pick; `multiple` shows removable chips, checkboxes,
 * and stays open while toggling. Closes on outside-click / Esc.
 */
export function Select(props: SelectProps) {
  const { label, error, placeholder = "Select…", options, id, disabled, required, optional, recommended, searchable, variant = "filled", className } = props;
  const ariaLabel = props["aria-label"];
  const displayValueOnly = props.displayValueOnly === true;
  const multiple = props.multiple === true;
  const showSearch = searchable ?? options.length > 6;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const toggle = () => {
    if (open) close();
    else setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedValues = props.multiple ? props.value : props.value ? [props.value] : [];
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const filteredOptions =
    showSearch && query.trim()
      ? options.filter((o) => {
          const q = query.trim().toLowerCase();
          return o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
        })
      : options;

  const pick = (v: string) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
      close();
    }
  };

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

      <div ref={rootRef} className="relative">
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={toggle}
          className={className || `flex w-full items-center justify-between gap-2 text-left text-sm text-on-surface transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${FIELD_STYLES[variant].control} ${multiple ? "min-h-10 py-2" : "h-10"} ${error ? FIELD_STYLES[variant].error : ""}`}
        >
          {selectedValues.length === 0 ? (
            <span className="text-on-surface-variant">{placeholder}</span>
          ) : multiple ? (
            <span className="flex flex-wrap gap-1.5">
              {selectedValues.map((v) => (
                <span
                  key={v}
                  className="flex items-center gap-1 rounded-lg bg-secondary-container px-2 py-1 text-xs font-medium text-on-secondary-container"
                >
                  {labelFor(v)}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${labelFor(v)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      pick(v);
                    }}
                    className="flex cursor-pointer items-center hover:text-on-surface"
                  >
                    <Icon name="close" size={14} />
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-on-surface">{displayValueOnly ? selectedValues[0] : labelFor(selectedValues[0])}</span>
          )}
          <Icon name="expand_more" size={20} className="shrink-0 text-on-surface-variant" />
        </button>

        {required && (
          // Focusable, visually-hidden mirror so native form validation enforces a selection.
          <input
            tabIndex={-1}
            aria-hidden="true"
            required
            value={selectedValues.length ? "set" : ""}
            onChange={() => { }}
            className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 opacity-0"
          />
        )}

        {open && (
          <div className={`absolute z-20 mt-2 flex max-h-72 flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-lg ${props.panelClassName ?? "w-full"}`}>
            {showSearch && (
              <div className="sticky top-0 border-b border-outline-variant/20 bg-surface-container-lowest p-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                    <Icon name="search" size={18} />
                  </span>
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="h-10 w-full rounded-lg border-none bg-surface-container-highest pl-9 pr-3 text-sm text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>
            )}
            <div className="overflow-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-on-surface-variant">No results</div>
              ) : (
                filteredOptions.map((o) => {
                  const isSelected = selectedValues.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => pick(o.value)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-container ${!multiple && isSelected ? "bg-surface-container font-semibold text-on-surface" : "text-on-surface"
                        }`}
                    >
                      {multiple ? (
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded border ${isSelected ? "border-primary bg-primary text-on-primary" : "border-outline-variant"
                            }`}
                        >
                          {isSelected && <Icon name="check" size={14} />}
                        </span>
                      ) : null}
                      <span className="flex-1">{o.label}</span>
                      {!multiple && isSelected && <Icon name="check" size={16} className="text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && <span className="px-1 text-xs font-medium text-error">{error}</span>}
    </div>
  );
}
