"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Small line under the title (e.g. a role · org). */
  subtitle?: string;
  children: React.ReactNode;
  /** Custom sticky footer (e.g. action buttons). Pass `null` to hide it. */
  footer?: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  widthClass?: string;
}

/**
 * Reusable right-side slide-in panel — the dashboard's detail drawer. Mirrors the
 * `modal/Modal.tsx` mechanics (portal to body, backdrop + Escape close, `modal-open`
 * scroll lock, sticky header / scrollable body / optional sticky footer) but docks
 * to the right edge full-height instead of centering. Used by User Management and
 * KYC Review.
 */
export function Drawer({ open, onClose, title, subtitle, children, footer, widthClass = "max-w-md" }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full ${widthClass} flex-col border-l border-outline-variant/30 bg-surface-container-lowest shadow-2xl`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-outline/10 p-4 sm:gap-4 sm:p-5">
          <div className="min-w-0">
            {title && <h2 className="truncate font-headline text-lg font-bold text-on-surface sm:text-xl">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-sm text-on-surface-variant">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="thin-scrollbar flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>

        {/* Footer */}
        {footer !== null && footer !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline/10 p-3 sm:gap-3 sm:p-4">{footer}</div>
        )}
      </aside>
    </div>,
    document.body
  );
}
