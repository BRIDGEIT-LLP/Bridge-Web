"use client";

import { useEffect, useState } from 'react';
import type { ApiError } from '@/lib/axios';
import { fetchUserDashboard } from '@/services/dashboard.service';
import { RoleDashboard } from './RoleDashboard';
import type { UserDashboardData } from '@/types/dashboard';

export function StartupView() {
    const [data, setData] = useState<UserDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetchUserDashboard()
            .then((d) => { if (!cancelled) { setData(d as UserDashboardData); setError(null); } })
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
            title="Startup Dashboard"
            subtitle="Raise funding and connect with investors."
            stats={[
                { label: "Profile Views",    value: String(data.stats.profileViews        || 0), icon: "visibility" },
                { label: "Investor Matches", value: String(data.stats.connectionsReceived  || 0), icon: "diversity_3" },
                { label: "Connections",      value: String(data.stats.connectionsAccepted  || 0), icon: "handshake" },
                { label: "Documents",        value: String(data.stats.kycDocumentsCount    || 0), icon: "folder" },
            ]}
            placeholder="Showcase your traction, browse matched investors, and manage your documents."
        />
    );
}
