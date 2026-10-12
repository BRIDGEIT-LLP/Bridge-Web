"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { logoutSession } from "@/lib/logout";

interface FocusedHeaderProps {
  /** Label next to the back arrow. */
  backLabel?: string;
  /** Where Back navigates; defaults to router.back(). */
  backHref?: string;
  /** Signed-in onboarding steps (KYC) can exit the session from here. */
  showLogout?: boolean;
}

export function FocusedHeader({ backLabel = "Back", backHref, showLogout = false }: FocusedHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutSession();
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => (backHref ? router.push(backHref) : router.back())}
        className="flex items-center gap-2 text-on-surface transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" size={20} />
        <span className="font-label text-sm font-semibold">{backLabel}</span>
      </button>
      {showLogout && (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 text-error transition-colors hover:text-error/80 disabled:opacity-50"
        >
          <Icon name="logout" size={20} />
          <span className="font-label text-sm font-semibold">{loggingOut ? "Logging out…" : "Logout"}</span>
        </button>
      )}
    </header>
  );
}
