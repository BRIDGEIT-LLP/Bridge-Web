"use client";

import { useHomeDashboard } from "@/components/dashboard/home/useHomeDashboard";
import { DashboardLoadState } from "@/components/dashboard/home/DashboardLoadState";
import { HomeScreen } from "@/components/dashboard/home/HomeScreen";

export function StartupView() {
    const { stats, home, loading, error } = useHomeDashboard();

    if (loading || error || !stats?.profile || !home) {
        return <DashboardLoadState loading={loading} error={error} />;
    }

    return <HomeScreen firstName={stats.profile.firstName} home={home} />;
}
