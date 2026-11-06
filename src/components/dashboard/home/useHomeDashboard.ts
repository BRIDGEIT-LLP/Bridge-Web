"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/lib/axios";
import { fetchUserDashboard, fetchUserDashboardHome } from "@/services/dashboard.service";
import type { HomeDashboardData, UserDashboardData } from "@/types/dashboard";

/** Fetches both the stat-card data and the S10 widget data in parallel for a
 *  role view (Startup/Investor/B2B). Shared so each view doesn't repeat the
 *  same loading/error wiring. */
export function useHomeDashboard() {
  const [stats, setStats] = useState<UserDashboardData | null>(null);
  const [home, setHome] = useState<HomeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchUserDashboard(), fetchUserDashboardHome()])
      .then(([statsData, homeData]) => {
        if (cancelled) return;
        setStats(statsData as UserDashboardData);
        setHome(homeData);
        setError(null);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err?.message ?? "Failed to fetch dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, home, loading, error };
}
