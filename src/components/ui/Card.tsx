import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  surface?: "lowest" | "low" | "default" | "high";
  /** Apply the signature soft "ambient" shadow. */
  ambient?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const surfaceClasses = {
  lowest: "bg-surface-container-lowest",
  low: "bg-surface-container-low",
  default: "bg-surface-container",
  high: "bg-surface-container-high",
};

const paddingClasses = { none: "", sm: "p-4", md: "p-6", lg: "p-10" };

/** Rounded-2xl tonal card with optional ambient shadow (per the Stitch design). */
export function Card({
  surface = "lowest",
  ambient = true,
  padding = "lg",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-2xl ${surfaceClasses[surface]} ${paddingClasses[padding]} ${
        ambient ? "ambient-shadow border border-white/40" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
