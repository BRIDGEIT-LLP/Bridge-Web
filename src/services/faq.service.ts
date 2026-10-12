import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type { FaqItem, FaqListResponse } from "@/types/api.types";

/**
 * Fetch all active FAQs from GET /api/v1/faqs.
 * The access token is attached automatically by the axios interceptor.
 * Returns a flat array of FAQ items (unwrapped from the backend envelope).
 */
export async function fetchFaqs(): Promise<FaqItem[]> {
  const { data } = await api.get<FaqListResponse>(API_ENDPOINTS.FAQS);
  return (data?.data ?? []) as FaqItem[];
}
