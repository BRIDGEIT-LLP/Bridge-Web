import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type {
  SubscriptionPlan,
  SubscriptionPlansResponse,
  SelectPlanPayload,
  SelectPlanResponse,
  UserSubscriptionData,
  UserSubscriptionResponse,
} from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

/**
 * Fetch all active subscription plans.
 * GET /api/v1/subscriptions/plans
 *
 * Each plan includes a server-calculated valid_till_preview date
 * (today + validity_days) so the UI renders it directly without client-side math.
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data } = await api.get<SubscriptionPlansResponse>(
    API_ENDPOINTS.SUBSCRIPTION_PLANS
  );
  return data.data ?? [];
}

/**
 * Select a plan for the authenticated user.
 * POST /api/v1/subscriptions/select  —  body: { plan_id }
 *
 * Any existing active subscription is cancelled on the server before the
 * new one is created. Response includes start_date and end_date.
 */
export async function selectSubscriptionPlan(
  payload: SelectPlanPayload
): Promise<SelectPlanResponse> {
  const { data } = await api.post<SelectPlanResponse>(
    API_ENDPOINTS.SUBSCRIPTION_SELECT,
    payload
  );
  return data;
}

/**
 * Fetch the authenticated user's currently active subscription.
 * GET /api/v1/subscriptions/my
 *
 * Returns null only on 404 (user has no active subscription — a normal state).
 * All other errors (network failures, 5xx, etc.) are re-thrown so the caller
 * can surface them to the user rather than silently rendering "no active plan".
 */
export async function getUserSubscription(): Promise<UserSubscriptionData | null> {
  try {
    const { data } = await api.get<UserSubscriptionResponse>(
      API_ENDPOINTS.SUBSCRIPTION_MY
    );
    return data.data ?? null;
  } catch (err) {
    const apiErr = err as ApiError;
    if (apiErr.status === 404) return null;
    throw err;
  }
}