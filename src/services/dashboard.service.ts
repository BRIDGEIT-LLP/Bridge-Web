import { api } from '@/lib/axios';
import type { ApiError } from '@/lib/axios';
import { API_ENDPOINTS } from '@/config/constant';

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

export async function fetchAdminDashboard() {
    return fetchDashboard(API_ENDPOINTS.ADMIN_DASHBOARD);
}

export async function fetchSuperAdminDashboard() {
    return fetchDashboard(API_ENDPOINTS.SUPER_ADMIN_DASHBOARD);
}