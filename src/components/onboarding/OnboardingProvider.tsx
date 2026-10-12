"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_STEPS, getStepIndex } from "@/lib/onboarding-steps";

/** Free-form form data collected across the registration steps. */
export type OnboardingData = Record<string, unknown>;

interface OnboardingContextValue {
  data: OnboardingData;
  completed: Record<string, boolean>;
  /** True once the persisted data has been loaded from localStorage. */
  isDataLoaded: boolean;
  setData: (patch: OnboardingData) => void;
  markComplete: (key: string) => void;
  goNext: (currentKey: string) => void;
  goBack: (currentKey: string) => void;
  reset: () => void;
}

const STORAGE_KEY = process.env.NEXT_PUBLIC_STORAGE_KEY ?? "bridge-platform.onboarding";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setDataState] = useState<OnboardingData>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDataState(parsed.data ?? {});
        setCompleted(parsed.completed ?? {});
      }
    } catch {
      /* ignore corrupt storage */
    } finally {
      // Mark loading complete so guards can safely read persisted values.
      setIsDataLoaded(true);
    }
  }, []);

  const persist = useCallback(
    (next: { data: OnboardingData; completed: Record<string, boolean> }) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    []
  );

  const setData = useCallback(
    (patch: OnboardingData) => {
      setDataState((prev) => {
        const next = { ...prev, ...patch };
        persist({ data: next, completed });
        return next;
      });
    },
    [completed, persist]
  );

  const markComplete = useCallback(
    (key: string) => {
      setCompleted((prev) => {
        const next = { ...prev, [key]: true };
        persist({ data, completed: next });
        return next;
      });
    },
    [data, persist]
  );

  const goNext = useCallback(
    (currentKey: string) => {
      markComplete(currentKey);
      const next = ONBOARDING_STEPS[getStepIndex(currentKey) + 1];
      if (next) router.push(next.route);
    },
    [markComplete, router]
  );

  const goBack = useCallback(
    (currentKey: string) => {
      const prev = ONBOARDING_STEPS[getStepIndex(currentKey) - 1];
      if (prev) router.push(prev.route);
    },
    [router]
  );

  const reset = useCallback(() => {
    setDataState({});
    setCompleted({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ data, completed, isDataLoaded, setData, markComplete, goNext, goBack, reset }),
    [data, completed, isDataLoaded, setData, markComplete, goNext, goBack, reset]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}
