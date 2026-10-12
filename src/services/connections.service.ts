import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import { normalizeRole } from "@/lib/roles";
import { CONNECTION_STATUS_API_VALUE } from "@/lib/connections";
import type {
  ConnectionActionPayload,
  ConnectionActionResponse,
  ConnectionDirection,
  ConnectionRequest,
  ConnectionStatus,
  SendConnectionRequestPayload,
  SendConnectionRequestResponse,
} from "@/types/api.types";

/**
 * Send a connection request (proposal) to a matched profile.
 *
 * POSTs to `/api/v1/connections`; the access token is attached automatically by
 * the axios interceptor, and the backend derives the sender + subscription tier
 * from the JWT (the sender identity in the body is for display/record only).
 */
export async function sendConnectionRequest(
  payload: SendConnectionRequestPayload,
): Promise<SendConnectionRequestResponse> {
  const { data } = await api.post<SendConnectionRequestResponse>(
    API_ENDPOINTS.CONNECTION_CREATE,
    payload,
  );
  return data;
}

/** Raw connection row as returned by GET /connections/{direction}. */
interface RawConnection {
  connection_id?: number | string;
  connection_message?: string;
  product_service_details?: string;
  connection_status?: string;
  connection_requested_at?: string;
  connection_updated_at?: string;
  bussiness_intent?: string | string[];
  // The counterparty is the recipient (for "sent") or the requester (for "received").
  requester_first_name?: string;
  requester_last_name?: string;
  requester_role_code?: string;
  requester_company_name?: string;
  requester_profile_photo?: string | null;
  recipient_first_name?: string;
  recipient_last_name?: string;
  recipient_role_code?: string;
  recipient_company_name?: string;
  recipient_profile_photo?: string | null;
}

/** Normalize one raw backend row into the UI's ConnectionRequest. */
function toConnectionRequest(raw: RawConnection, direction: ConnectionDirection): ConnectionRequest {
  // Show the OTHER party: recipient for sent, requester for received.
  const other =
    direction === "sent"
      ? {
          first: raw.recipient_first_name,
          last: raw.recipient_last_name,
          role: raw.recipient_role_code,
          company: raw.recipient_company_name,
          photoKey: raw.recipient_profile_photo,
        }
      : {
          first: raw.requester_first_name,
          last: raw.requester_last_name,
          role: raw.requester_role_code,
          company: raw.requester_company_name,
          photoKey: raw.requester_profile_photo,
        };
  const name = [other.first, other.last].filter(Boolean).join(" ").trim();
  const intent = Array.isArray(raw.bussiness_intent)
    ? raw.bussiness_intent.join(", ")
    : raw.bussiness_intent ?? "";

  return {
    id: String(raw.connection_id ?? ""),
    direction,
    name: name || other.company || "—",
    company: other.company ?? "",
    role: normalizeRole(other.role) ?? "startup",
    photoKey: other.photoKey,
    intent,
    message: raw.connection_message ?? "",
    productServiceDetails: raw.product_service_details ?? "",
    status: ((raw.connection_status ?? "PENDING").toUpperCase() as ConnectionStatus),
    createdAt: raw.connection_requested_at ?? "",
    updatedAt: raw.connection_updated_at ?? raw.connection_requested_at ?? "",
  };
}

/**
 * List my connection requests for a direction ("incoming" = received, "sent" = sent). GET.
 * Maps the backend's snake_case rows into the UI's ConnectionRequest shape.
 */
export async function fetchConnections(direction: ConnectionDirection): Promise<ConnectionRequest[]> {
  const { data } = await api.get<{ data?: RawConnection[] }>(API_ENDPOINTS.CONNECTIONS_LIST(direction));
  return (data.data ?? []).map((raw) => toConnectionRequest(raw, direction));
}

/** Change a request's status (accept / decline / defer / withdraw). PUT
 *  /connections/change-status, body: { connectionId, status } (title-case status). */
export async function actOnConnection(
  id: string,
  status: ConnectionStatus,
  reason?: string,
): Promise<ConnectionActionResponse> {
  const body: ConnectionActionPayload = {
    connectionId: Number(id),
    status: CONNECTION_STATUS_API_VALUE[status],
    ...(reason ? { reason } : {}),
  };
  const { data } = await api.put<ConnectionActionResponse>(API_ENDPOINTS.CONNECTION_ACTION, body);
  return data;
}
