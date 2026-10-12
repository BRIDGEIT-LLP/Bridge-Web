"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isUserRole } from "@/lib/roles";
import { SubscriptionPlansScreen } from "@/components/subscription/SubscriptionPlansScreen";

/**
 * Subscription plans page — accessible to user roles only (startup, investor, b2b_enterprise).
 * Admin and super_admin are redirected to the dashboard; their subscription
 * management panel is separate work to be built out later.
 */
export default function SubscriptionPage() {
    const { role } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (role && !isUserRole(role)) {
            router.replace("/dashboard");
        }
    }, [role, router]);

    // Render nothing while the role is loading or if the user is being redirected
    if (!role || !isUserRole(role)) return null;

    return <SubscriptionPlansScreen />;
}
