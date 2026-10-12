import React from "react";

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Material Symbols Outlined icon name, e.g. "business_center", "verified_user". */
  name: string;
  /** Optical size in px (maps to font-size). */
  size?: number;
  /** Render the filled variant. */
  filled?: boolean;
  weight?: number;
}

/**
 * Thin wrapper over the Material Symbols Outlined font (loaded in the root layout).
 * Centralizes icon usage so screens reference the same names the Stitch HTML uses.
 */
export function Icon({
  name,
  size = 24,
  filled = false,
  weight = 400,
  className = "",
  style,
  ...props
}: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
