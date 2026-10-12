// src/types/dashboard.ts

export interface UserDashboardData {
  profile?: {
    firstName: string;
    lastName: string;
    organizationName: string;
    role: string;
    isActive: boolean;
    kycStatus: string;
  };
  stats?: {
    connectionsSent: number;
    connectionsReceived: number;
    connectionsAccepted: number;
    activeDealRooms: number;
    kycDocumentsCount: number;
    upcomingMeetingsCount: number;
    profileViews: number;
    watchlistCount: number;
  };
}

export interface AdminDashboardData {
  adminProfile?: {
    name: string;
    role: string;
  };
  stats?: {
    totalUsers: number;
    suspendedUsers: number;
    newRegistrationsLast7Days: number;
    kycPending: number;
    kycApproved: number;
    kycRejected: number;
  };
}

export interface SuperAdminDashboardData {
  adminProfile?: {
    name: string;
    role: string;
  };
  stats?: {
    totalUsers: number;
    totalOrganizations: number;
    kycPending: number;
    activeToday: number;
    kycApproved: number;
    kycRejected: number;
    suspendedUsers: number;
    newRegistrationsLast7Days: number;
    totalAdmins: number;
    activeAdmins: number;
    suspendedAdmins: number;
  };
}
