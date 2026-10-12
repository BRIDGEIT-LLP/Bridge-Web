import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type { SaveKycInfoPayload, SaveKycInfoResponse } from "@/types/api.types";

/**
 * Save KYC document info (document-upload step).
 *
 * Sends the typed Aadhaar/PAN numbers together with the `s3Key`s produced by the scan
 * uploads (see `file.service.ts`). The access token is attached automatically by the
 * axios interceptor.
 */
export async function saveKycInfo(payload: SaveKycInfoPayload): Promise<SaveKycInfoResponse> {
  const { data } = await api.post<SaveKycInfoResponse>(API_ENDPOINTS.SAVE_KYC_INFO, payload);
  return data;
}
