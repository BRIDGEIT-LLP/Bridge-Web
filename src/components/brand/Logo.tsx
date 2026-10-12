import React from "react";
import Link from "next/link";

interface LogoProps {
  iconOnly?: boolean;
  href?: string;
  className?: string;
  textClassName?: string;
}


export function Logo({
  iconOnly = false,
  href = "/",
  className = "",
  textClassName = "text-on-surface",
}: LogoProps) {
  const content = (
    <span className={`flex items-center gap-3 ${className}`}>
      <span className="size-8 text-primary shrink-0">
        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path
            clipRule="evenodd"
            fillRule="evenodd"
            fill="currentColor"
            d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z"
          />
        </svg>
      </span>
      {!iconOnly && (
        <span className={`font-display text-xl font-bold tracking-tight ${textClassName}`}>
          Bridge
        </span>
      )}
    </span>
  );

  return href ? (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  ) : (
    content
  );
}
