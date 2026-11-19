"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export interface BottomTabItem {
  key: string;
  label: string;
  /** Material Symbols Outlined icon name. */
  icon: string;
  /** Renders a link when set. Omit and pass `onClick` for an action tab (e.g. "More"). */
  href?: string;
  onClick?: () => void;
  /** Highlights the tab as the current one. */
  active?: boolean;
  /** Red count pill on the icon. Hidden when 0 / undefined; capped at "99+". */
  badge?: number;
}

interface BottomTabBarProps {
  items: BottomTabItem[];
  /** Accessible name for the nav landmark. */
  ariaLabel?: string;
  /** Extra classes on the root — visibility breakpoints etc. (default: mobile only). */
  className?: string;
}

function Badge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} pending`}
      className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-4 text-on-error"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Generic mobile bottom tab bar. Presentational only — the caller supplies the tabs,
 * active state and badge counts, so it can be reused on any screen/layout.
 * Hidden from `lg` up by default; override via `className`.
 */
export function BottomTabBar({
  items,
  ariaLabel = "Primary",
  className = "lg:hidden",
}: BottomTabBarProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`shrink-0 border-t border-outline-variant/30 bg-surface-container-low pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const tone = item.active ? "text-primary" : "text-on-surface-variant";
          const content = (
            <>
              <span className="relative">
                <Icon name={item.icon} size={22} filled={item.active} />
                {!!item.badge && item.badge > 0 && <Badge count={item.badge} />}
              </span>
              <span className="max-w-full truncate text-[11px] font-semibold">{item.label}</span>
            </>
          );
          const cls = `flex w-full flex-col items-center gap-0.5 px-1 py-2 transition-colors hover:text-on-surface ${tone}`;

          return (
            <li key={item.key} className="min-w-0 flex-1">
              {item.href ? (
                <Link href={item.href} aria-current={item.active ? "page" : undefined} className={cls}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={item.onClick} className={cls}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
