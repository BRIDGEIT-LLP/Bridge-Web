"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { isUserRole } from "@/lib/roles";
import { DashboardSidebar } from "@/components/layout/sidebar";
import { DashboardNavbar } from "@/components/layout/navbar";
import { getSessionLimitStatus } from "@/services/session.service";
import type { ApiError } from "@/lib/axios";
const FULL_SESSION_TOKEN_TYPE = "AUTH_ACCESS_TOKEN";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { role, tokenType, isLoaded } = useAuth();
  const hasFullSession = tokenType === FULL_SESSION_TOKEN_TYPE;
  const [verified, setVerified] = useState(false);
  // Set on a non-401 verification failure (network drop, timeout, 500, CORS
  // misconfig) — a 401 is handled globally by axios.ts's interceptor (clears the
  // session + redirects), so it never needs this. Without this, a transient failure
  // would leave the user stuck on "Loading…" forever with no way out.
  const [checkError, setCheckError] = useState(false);
  // Bumped by the Retry button to re-run the verification effect.
  const [retryKey, setRetryKey] = useState(0);
  // Mobile nav drawer (below lg). Owned here because the navbar's hamburger opens it
  // and the sidebar renders it — `onClose` is stable so the sidebar's route-change
  // and Escape effects don't re-run every render.
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mq.matches) setNavOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!hasFullSession || !role) {
      router.replace("/login");
      return;
    }
  }, [isLoaded, role, hasFullSession, router, retryKey]);

  if (checkError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-on-surface-variant">
        <p>Couldn&apos;t verify your session — check your connection.</p>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium hover:bg-surface-container"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isLoaded || !role || !hasFullSession) {
    return (
      <div className="flex h-full items-center justify-center text-on-surface-variant">
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <DashboardSidebar open={navOpen} onClose={closeNav} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardNavbar onMenuClick={() => setNavOpen(true)} />
        <div className="thin-scrollbar flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
