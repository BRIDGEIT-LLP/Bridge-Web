import React from "react";

export interface LoaderProps {
  size?: "small" | "medium" | "large" | number;
  className?: string;
  color?: string;
}

export function Loader({ size = "medium", className = "", color = "currentColor" }: LoaderProps) {
  // Map sizes to pixel values
  const sizeMap = {
    small: 16,
    medium: 28,
    large: 48,
  };

  const pixelSize = typeof size === "number" ? size : sizeMap[size] || sizeMap.medium;

  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ flexShrink: 0 }}>
      <svg
        className="animate-spin"
        style={{ flexShrink: 0 }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        width={pixelSize}
        height={pixelSize}
        aria-label={`${typeof size === "string" ? size : "custom"} loading`}
      >
        <circle
          style={{ opacity: 0.25 }}
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3.5"
        />
        <path
          style={{ opacity: 0.75 }}
          fill={color}
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}
