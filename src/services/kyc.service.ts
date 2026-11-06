import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type { KycRequirementsData, SaveKycInfoPayload, SaveKycInfoResponse } from "@/types/api.types";

/**
 * Save KYC document info (document-upload step).
 *
 * Sends the typed Aadhaar/PAN numbers together with the `s3Key`s produced by the scan
 * uploads (see `file.service.ts`). The access token is attached automatically by the
 * axios interceptor.
 */
export async function saveKycInfo(
  payload: SaveKycInfoPayload,
  /** Set to store the documents as a draft (nothing is submitted for review) from this step. */
  draftStep?: "documents" | "review",
): Promise<SaveKycInfoResponse> {
  // draft: store what is there without submitting the documents for review
  const { data } = await api.post<SaveKycInfoResponse>(API_ENDPOINTS.SAVE_KYC_INFO, payload, {
    params: draftStep ? { draft: true, step: draftStep } : undefined,
  });
  return data;
}

/** Documents and numbers the Documents step needs for the signed-in role, plus anything already uploaded. */
export async function getKycRequirements(): Promise<KycRequirementsData> {
  const { data } = await api.get<{ data: KycRequirementsData }>(API_ENDPOINTS.KYC_REQUIREMENTS);
  return data.data;
}
