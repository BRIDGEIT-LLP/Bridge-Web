"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { SuperAdminView } from "@/components/dashboard/views/SuperAdminView";
import { AdminView } from "@/components/dashboard/views/AdminView";
import { StartupView } from "@/components/dashboard/views/StartupView";
import { InvestorView } from "@/components/dashboard/views/InvestorView";
import { B2BView } from "@/components/dashboard/views/B2BView";
import type { Role } from "@/lib/roles";

/** Maps each role to its dashboard view. The layout guards auth + role presence. test */
const VIEW_BY_ROLE: Record<Role, React.ComponentType> = {
  super_admin: SuperAdminView,
  admin: AdminView,
  startup: StartupView,
  investor: InvestorView,
  b2b_enterprise: B2BView,
};

export default function DashboardPage() {
  const { role } = useAuth();
  if (!role) return null;
  const View = VIEW_BY_ROLE[role];
  return <View />;
}
