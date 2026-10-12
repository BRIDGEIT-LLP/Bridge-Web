import React from "react";
import Link from "next/link";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";

interface BaseProps {
  variant?: Variant;
  leadingIcon?: string;
  trailingIcon?: string;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type ButtonAsButton = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & { href?: undefined };
type ButtonAsLink = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> & { href: string };

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantClasses: Record<Variant, string> = {
  // Signature gradient CTA from the Stitch screens.
  primary: "cta-gradient text-on-primary shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.98]",
  secondary: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
  ghost: "text-on-surface-variant hover:bg-surface-container",
};

/** h-12 rounded-xl action button. Renders an <a> when `href` is provided. */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    className = "",
    children,
    ...rest
  } = props;

  const classes = `inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 font-headline text-base font-bold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`;

  const inner = (
    <>
      {leadingIcon && <Icon name={leadingIcon} size={20} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={20} />}
    </>
  );

  if ("href" in props && props.href) {
    const { href, ...anchorRest } = rest as React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    };
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {inner}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  );
}
