"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ONBOARDING_STEPS, getStepIndex } from "@/lib/onboarding-steps";
import { getSession } from "@/lib/auth-session";
import { normalizeRole, USER_ROLES } from "@/lib/roles";
import { getRegistrationState } from "@/services/auth.service";

/** Free-form form data shared across the registration steps. Held in memory only: nothing is kept in the browser. */
export type OnboardingData = Record<string, unknown>;

interface OnboardingContextValue {
  data: OnboardingData;
  completed: Record<string, boolean>;
  /** True once the saved application has been loaded from the server (or there was nothing to load). */
  isDataLoaded: boolean;
  setData: (patch: OnboardingData) => void;
  markComplete: (key: string) => void;
  goNext: (currentKey: string) => void;
  goBack: (currentKey: string) => void;
  reset: () => void;
  /** Re-load the saved application (account details, verification, address/consent) from the database. */
  refreshFromServer: () => Promise<void>;
}

// The application is saved in the database (every step's "Save as draft" and Continue write there). Earlier
// versions also kept a copy under this key in localStorage; it is wiped on load so no draft lingers in the browser.
const LEGACY_STORAGE_KEY = process.env.NEXT_PUBLIC_STORAGE_KEY ?? "bridge-platform.onboarding";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Server values only fill what is still empty, so anything just typed in this visit is never overwritten. */
function fillEmpty(prev: OnboardingData, fromServer: OnboardingData): OnboardingData {
  const next = { ...prev };
  for (const [key, value] of Object.entries(fromServer)) {
    const cur = next[key];
    if (cur === undefined || cur === null || cur === "") next[key] = value;
  }
  return next;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setDataState] = useState<OnboardingData>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const refreshFromServer = useCallback(async () => {
    try {
      const res = await getRegistrationState();
      const s = res.data;
      if (!s) return;
      const role = normalizeRole(s.role);
      setDataState((prev) =>
        fillEmpty(prev, {
          legalName: s.companyName ?? "",
          email: s.email ?? "",
          countryCode: s.countryCode ?? "",
          contact: s.mobileNumber ?? "",
          firstName: s.firstName ?? "",
          lastName: s.lastName ?? "",
          isEmailVerified: Boolean(s.isEmailVerified),
          isPhoneVerified: Boolean(s.isPhoneVerified),
          kycAddress: s.kycAddress ?? "",
          kycConsent: Boolean(s.kycConsent),
          ...(role ? { role } : {}),
        }),
      );
    } catch {
      /* not signed in, or offline: the pages fall back to their own server reads */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    try {
      // The role is needed by every registration step (intent options, documents, review); the signed-in session
      // carries it, so a reload still knows which form to show.
      const sessionRole = getSession()?.role;
      if (sessionRole && USER_ROLES.includes(sessionRole)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDataState((prev) => (prev.role ? prev : { ...prev, role: sessionRole }));
      }
    } catch {
      /* ignore */
    }

    // A reload (or coming back in a new browser session) in the middle of the application: load the saved
    // application from the database before the page reads it. A brand-new signup (/registration without ?edit=1)
    // has nothing to load.
    const onRegistration = pathname?.startsWith("/registration") ?? false;
    const isFreshSignup = pathname === "/registration" && !new URLSearchParams(window.location.search).has("edit");
    if (onRegistration && !isFreshSignup) {
      void refreshFromServer().finally(() => setIsDataLoaded(true));
    } else {
      setIsDataLoaded(true);
    }
    // Runs once on mount: later navigation keeps the in-memory data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setData = useCallback((patch: OnboardingData) => {
    setDataState((prev) => ({ ...prev, ...patch }));
  }, []);

  const markComplete = useCallback((key: string) => {
    setCompleted((prev) => ({ ...prev, [key]: true }));
  }, []);

  const goNext = useCallback(
    (currentKey: string) => {
      markComplete(currentKey);
      const next = ONBOARDING_STEPS[getStepIndex(currentKey) + 1];
      if (next) router.push(next.route);
    },
    [markComplete, router],
  );

  const goBack = useCallback(
    (currentKey: string) => {
      const prev = ONBOARDING_STEPS[getStepIndex(currentKey) - 1];
      if (prev) router.push(prev.route);
    },
    [router],
  );

  const reset = useCallback(() => {
    setDataState({});
    setCompleted({});
  }, []);

  const value = useMemo(
    () => ({ data, completed, isDataLoaded, setData, markComplete, goNext, goBack, reset, refreshFromServer }),
    [data, completed, isDataLoaded, setData, markComplete, goNext, goBack, reset, refreshFromServer],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}
