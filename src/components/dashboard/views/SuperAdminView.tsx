"use client";

import { useEffect, useState } from 'react';
import type { ApiError } from '@/lib/axios';
import { fetchSuperAdminDashboard } from '@/services/dashboard.service';
import { RoleDashboard } from './RoleDashboard';
import type { SuperAdminDashboardData } from '@/types/dashboard';

export function SuperAdminView() {
    const [data, setData] = useState<SuperAdminDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetchSuperAdminDashboard()
            .then((d) => { if (!cancelled) { setData(d as SuperAdminDashboardData); setError(null); } })
            .catch((err: ApiError) => { if (!cancelled) setError(err?.message ?? 'Failed to fetch dashboard'); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, []);

    const fmt = (n: number | undefined) =>
        (n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="mt-4 text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center text-red-600">
                    <p className="text-lg font-semibold">Error loading dashboard</p>
                    <p className="text-sm mt-2">{error}</p>
                </div>
            </div>
        );
    }

    if (!data || !data.stats) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-600">
                    <p>No dashboard data available</p>
                </div>
            </div>
        );
    }

    return (
        <RoleDashboard
            title="Super Admin Dashboard"
            subtitle="Platform-wide overview and controls."
            stats={[
                { label: "Total Users",    value: fmt(data.stats.totalUsers),          icon: "group" },
                { label: "Organizations",  value: fmt(data.stats.totalOrganizations),  icon: "corporate_fare" },
                { label: "Pending KYC",   value: String(data.stats.kycPending || 0),  icon: "verified_user" },
                { label: "Active Today",   value: fmt(data.stats.activeToday),         icon: "trending_up" },
            ]}
            placeholder="Manage users, organizations, KYC approvals, and platform settings from here."
        />
    );
}
