"use client";

import { useEffect, useState } from 'react';
import type { ApiError } from '@/lib/axios';
import { fetchAdminDashboard } from '@/services/dashboard.service';
import { RoleDashboard } from './RoleDashboard';
import type { AdminDashboardData } from '@/types/dashboard';

export function AdminView() {
    const [data, setData] = useState<AdminDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetchAdminDashboard()
            .then((d) => { if (!cancelled) { setData(d as AdminDashboardData); setError(null); } })
            .catch((err: ApiError) => { if (!cancelled) setError(err?.message ?? 'Failed to fetch dashboard'); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, []);

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
            title="Admin Dashboard"
            subtitle="Review verifications and manage users."
            stats={[
                { label: "KYC To Review",  value: String(data.stats.kycPending                  || 0), icon: "verified_user" },
                { label: "New This Week",  value: String(data.stats.newRegistrationsLast7Days    || 0), icon: "trending_up" },
                { label: "Suspended Users", value: String(data.stats.suspendedUsers             || 0), icon: "block" },
                { label: "Total Users",    value: String(data.stats.totalUsers                   || 0), icon: "group" },
            ]}
            placeholder="Process pending KYC approvals and manage user accounts."
        />
    );
}
