import { api } from '@/lib/axios';
import type { ApiError } from '@/lib/axios';
import { API_ENDPOINTS } from '@/config/constant';
import { toConnectionRequest, type RawConnection } from './connections.service';
import { toDealRoom, type RawRoom } from './deal-room.service';
import type { HomeDashboardData } from '@/types/dashboard';

async function fetchDashboard<T>(endpoint: string): Promise<T> {
    const response = await api.get(endpoint);
    const body = response.data;
    if (body && body.success === false) {
        const err: ApiError = {
            message: body.message || 'Dashboard request failed',
            status: response.status,
            data: body,
        };
        throw err;
    }
    return body.data as T;
}

export async function fetchUserDashboard() {
    return fetchDashboard(API_ENDPOINTS.USER_DASHBOARD);
}

/** Raw /users/dashboard/home payload — requestsForYou/dealRooms arrive as the
 *  same flat rows GET /connections/received and GET /deal-rooms return. */
interface RawHomeDashboard extends Omit<HomeDashboardData, 'requestsForYou' | 'dealRooms'> {
    requestsForYou: RawConnection[];
    dealRooms: RawRoom[];
}

export async function fetchUserDashboardHome(): Promise<HomeDashboardData> {
    const raw = await fetchDashboard<RawHomeDashboard>(API_ENDPOINTS.USER_DASHBOARD_HOME);
    return {
        ...raw,
        requestsForYou: (raw.requestsForYou ?? []).map((row) => toConnectionRequest(row, 'received')),
        dealRooms: (raw.dealRooms ?? []).map(toDealRoom),
    };
}

export async function fetchAdminDashboard() {
    return fetchDashboard(API_ENDPOINTS.ADMIN_DASHBOARD);
}

export async function fetchSuperAdminDashboard() {
    return fetchDashboard(API_ENDPOINTS.SUPER_ADMIN_DASHBOARD);
}