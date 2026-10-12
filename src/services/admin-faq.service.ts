import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type {
  AdminFaqListData,
  AdminFaqListResponse,
  CreateFaqPayload,
  UpdateFaqPayload,
  FaqActionResponse,
} from "@/types/api.types";

/**
 * Admin FAQ management service.
 * All functions require an admin JWT — attached automatically by the axios interceptor.
 */


export async function fetchAllFaqsForAdmin(): Promise<AdminFaqListData> {
  const { data } = await api.get<AdminFaqListResponse>(API_ENDPOINTS.ADMIN_FAQS);
  return {
    faqs: data?.data?.faqs ?? [],
    isAllowdToUpsert: data?.data?.isAllowdToUpsert ?? false,
  };
}

/** Create a new FAQ entry. */
export async function createFaq(payload: CreateFaqPayload): Promise<FaqActionResponse> {
  const { data } = await api.post<FaqActionResponse>(API_ENDPOINTS.ADMIN_FAQ_CREATE, payload);
  return data;
}

/** Update an existing FAQ entry by id. */
export async function updateFaq(id: number, payload: UpdateFaqPayload): Promise<FaqActionResponse> {
  const { data } = await api.put<FaqActionResponse>(API_ENDPOINTS.ADMIN_FAQ_UPDATE(String(id)), payload);
  return data;
}