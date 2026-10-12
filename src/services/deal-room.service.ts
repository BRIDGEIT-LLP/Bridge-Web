/**
 * Deal Room API layer — wired to Bridge-Server (`/api/v1/deal-rooms`, JWT). The pages
 * call these functions (never axios directly), and the `to*` normalizers map the
 * backend's flat snake_case rows into the UI's `DealRoom` / `DealMessage` types.
 *
 * Contract notes (see Bridge-Server):
 * - The list returns BOTH participants (`requester_*` + `recipient_*`); we pick the
 *   counterparty by comparing the logged-in user id (`getCurrentUserId`) to each side.
 * - There is NO single-room-detail endpoint, so `fetchDealRoom` fetches the list and
 *   finds the room. (A `GET /deal-rooms/:id` would be cleaner — flagged to backend.)
 * - The list carries no stage/unread/last-message → those default (stage 0, unread 0,
 *   lastActivity = room created date), matching the "keep UI, safe defaults" decision.
 * - TEXT messages are sent over the socket (`send_message`), not a REST call; this file
 *   only fetches history + closes the room. `normalizeMessage` is exported for the
 *   socket `new_message` handler to reuse.
 */

import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import { normalizeRole } from "@/lib/roles";
import { getCurrentUserId } from "@/lib/jwt";
import { stageIndexFromValue } from "@/components/dashboard/deal-room/deal-room-meta";
import type {
  B2BTermSheet,
  DealAttachment,
  DealFundingOffer,
  DealMessage,
  DealRoom,
  DealStageRequest,
  FundingOfferStatus,
  ScheduledMeeting,
  ValuationType,
} from "@/components/dashboard/deal-room/types";

/** One flat deal-room row from `GET /deal-rooms` (snake_case, both participants inline). */
interface RawRoom {
  // deal_room_id is a UUID string (deal_room.id was already UUID before this migration).
  deal_room_id: number | string;
  title: string | null;
  deal_room_status: string; // "Active" | "Closed"
  deal_room_stage?: string | null; // "Initial Connection" | "Negotiation" | "Due Diligence" | "Closed"
  deal_room_created_at: string;
  // Per-user archive timestamp (LEFT JOIN deal_room_archive) — null when the caller
  // hasn't archived this room, an ISO string when they have.
  archived_at?: string | null;
  /** UUID of the requester user. */
  requester_user_id: string;
  requester_first_name?: string;
  requester_last_name?: string;
  requester_role_code?: string;
  // TODO: confirm with backend — needed (with requester_company_id) to open this
  // participant's profile preview page (GET /users/role-details), same ids the
  // navbar search result already returns as role_id/company_id.
  requester_role_id?: number;
  /** UUID of the requester company. */
  requester_company_id?: string;
  requester_company_name?: string;
  // `*_country` comes from the `user` table (GET /deal-rooms now joins it). `*_state`
  // doesn't exist anywhere in Bridge-Server's schema — no state/province column on
  // `user` or `company` — so it's always undefined; kept only so formatLocation() still
  // renders a state if that column is ever added.
  requester_state?: string;
  requester_country?: string;
  requester_profile_photo?: string | null;
  /** UUID of the recipient user. */
  recipient_user_id: string;
  recipient_first_name?: string;
  recipient_last_name?: string;
  recipient_role_code?: string;
  // TODO: confirm with backend — see requester_role_id/requester_company_id above.
  recipient_role_id?: number;
  /** UUID of the recipient company. */
  recipient_company_id?: string;
  recipient_company_name?: string;
  recipient_state?: string;
  recipient_country?: string;
  /** Storage key for the recipient's profile picture (`user.profile_photo`). */
  recipient_profile_photo?: string | null;
}

/** One message row from `GET /deal-rooms/:id/messages` (+ nested sender in history). */
export interface RawMessage {
  id: number;
  deal_room_id?: string;
  /** UUID of the sender user. */
  sender_user_id: string;
  message: string | null;
  message_type?: string; // TEXT | IMAGE | DOCUMENT | AUDIO | VIDEO
  attachment_file_name?: string | null;
  attachment_file_size?: number | null;
  attachment_s3_key?: string | null;
  attachment_mime_type?: string | null;
  download_allowed?: boolean | null;
  read_at?: string | null;
  created_at: string;
  sender?: { id: string; first_name?: string; last_name?: string } | null;
}

const fullName = (first?: string, last?: string) => [first, last].filter(Boolean).join(" ").trim();

/** Coerce a truthy-ish value (boolean, "true"/"false"/"1"/"0", 1/0) to a boolean. */
function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["true", "1", "yes"].includes(v.trim().toLowerCase());
  return false;
}

/**
 * Read the "download allowed" permission from a raw row, tolerant of the exact field
 * name and type the backend uses. Checks the download flag first; if absent, falls back
 * to the inverse of an explicit `view_only`/`is_view_only` flag. Defaults to false.
 */
function readDownloadAllowed(raw: Record<string, unknown>): boolean {
  const downloadKey = ["download_allowed", "downloadAllowed", "allow_download", "is_download_allowed", "can_download"].find(
    (k) => raw[k] != null,
  );
  if (downloadKey) return toBool(raw[downloadKey]);

  const viewKey = ["view_only", "viewOnly", "is_view_only"].find((k) => raw[k] != null);
  if (viewKey) return !toBool(raw[viewKey]);

  return false;
}

/** Build a DealRoom from a flat row, picking the counterparty relative to the current user. */
function toDealRoom(raw: RawRoom): DealRoom {
  const me = getCurrentUserId();
  // Both me and raw.*_user_id are now UUID strings — strict equality works correctly.
  const iAmRequester = me != null && me === raw.requester_user_id;
  const cp = iAmRequester
    ? {
        userId: raw.recipient_user_id,
        roleId: raw.recipient_role_id,
        companyId: raw.recipient_company_id,
        name: fullName(raw.recipient_first_name, raw.recipient_last_name),
        company: raw.recipient_company_name ?? "",
        state: raw.recipient_state ?? "",
        country: raw.recipient_country ?? "",
        role: raw.recipient_role_code,
        photoKey: raw.recipient_profile_photo,
      }
    : {
        userId: raw.requester_user_id,
        roleId: raw.requester_role_id,
        companyId: raw.requester_company_id,
        name: fullName(raw.requester_first_name, raw.requester_last_name),
        company: raw.requester_company_name ?? "",
        state: raw.requester_state ?? "",
        country: raw.requester_country ?? "",
        role: raw.requester_role_code,
        photoKey: raw.requester_profile_photo,
      };

  return {
    id: String(raw.deal_room_id),
    title: raw.title || cp.company || "Deal Room",
    counterparty: {
      userId: cp.userId,
      // TODO: 0 is a placeholder until the backend adds requester/recipient_role_id +
      // _company_id to GET /deal-rooms (see RawRoom above) — the profile preview link
      // won't resolve correctly until then.
      roleId: cp.roleId ?? 0,
      // companyId is now a UUID string; fall back to empty string instead of 0.
      companyId: cp.companyId ?? "",
      name: cp.name || cp.company || "—",
      title: "", // backend has no designation field
      company: cp.company,
      state: cp.state,
      country: cp.country,
      role: normalizeRole(cp.role) ?? "startup",
      photoKey: cp.photoKey ?? null,
    },
    status: raw.deal_room_status === "Closed" ? "CLOSED" : "ACTIVE",
    isArchived: raw.archived_at != null,
    stage: stageIndexFromValue(raw.deal_room_stage),
    lastActivityNote: "",
    lastActivityAt: raw.deal_room_created_at ?? "",
    unread: 0,
    messages: [], // populated separately via fetchDealRoomMessages
  };
}

/**
 * Text and media live in separate tables with independent auto-increment ids, so a
 * TEXT row and a DOCUMENT row can both be `id: 5`. The UI (React keys + live-message
 * de-dupe) must namespace them or a newly shared file is dropped as a "duplicate".
 */
function timelineMessageId(raw: RawMessage): string {
  const isMedia = Boolean(
    raw.attachment_file_name || (raw.message_type && raw.message_type !== "TEXT"),
  );
  return `${isMedia ? "media" : "text"}-${raw.id}`;
}

/** Normalize one raw message into a UI DealMessage. Exported for the socket handler. */
export function normalizeMessage(raw: RawMessage): DealMessage {
  const me = getCurrentUserId();
  // Both me and raw.sender_user_id are now UUID strings.
  const mine = me != null && raw.sender_user_id === me;
  const attachment: DealAttachment | undefined = raw.attachment_file_name
    ? {
        messageId: String(raw.id),
        name: raw.attachment_file_name,
        size: raw.attachment_file_size ?? 0,
        // Images render an inline/preview thumbnail; everything else is a file chip.
        kind: raw.attachment_mime_type?.startsWith("image/") ? "image" : "file",
        ...(raw.attachment_s3_key ? { s3Key: raw.attachment_s3_key } : {}),
        ...(raw.attachment_mime_type ? { mimeType: raw.attachment_mime_type } : {}),
        downloadAllowed: readDownloadAllowed(raw as unknown as Record<string, unknown>),
        url: "",
      }
    : undefined;
  return {
    id: timelineMessageId(raw),
    sender: mine ? "me" : "them",
    authorName: mine ? "You" : fullName(raw.sender?.first_name, raw.sender?.last_name),
    ...(raw.message ? { text: raw.message } : {}),
    ...(attachment ? { attachment } : {}),
    at: raw.created_at ?? new Date().toISOString(),
    read: !!raw.read_at,
  };
}

/** List the current user's deal rooms. GET. */
export async function fetchDealRooms(archived = false): Promise<DealRoom[]> {
  const { data } = await api.get<{ data?: RawRoom[] }>(API_ENDPOINTS.DEAL_ROOMS_LIST, {
    // Backend returns the caller's active (non-archived) rooms by default, or their
    // archived rooms with ?archived=true.
    params: archived ? { archived: true } : undefined,
  });
  return (data.data ?? []).map(toDealRoom).filter((r) => r.id !== "");
}

/** Fetch a single room's meta by finding it in the list (no detail endpoint exists).
 *  Checks the active list first, then the archived one — so an archived room still opens
 *  (and carries `isArchived: true` for the Archive/Unarchive toggle). */
export async function fetchDealRoom(id: string): Promise<DealRoom | undefined> {
  const active = await fetchDealRooms(false);
  const found = active.find((r) => r.id === id);
  if (found) return found;
  const archived = await fetchDealRooms(true);
  return archived.find((r) => r.id === id);
}

/** Archive a deal room for the current user only (moves it to the Archived tab). PUT. */
export async function archiveDealRoom(id: string): Promise<void> {
  await api.put(API_ENDPOINTS.DEAL_ROOM_ARCHIVE(id));
}

/** Unarchive a deal room for the current user (restores it to Active/Closed). PUT. */
export async function unarchiveDealRoom(id: string): Promise<void> {
  await api.put(API_ENDPOINTS.DEAL_ROOM_UNARCHIVE(id));
}

/** Fetch a room's message history (returned newest-first; reversed to chronological). */
export async function fetchDealRoomMessages(id: string): Promise<DealMessage[]> {
  const { data } = await api.get<{ data?: RawMessage[] }>(API_ENDPOINTS.DEAL_ROOM_MESSAGES(id));
  return (data.data ?? []).map(normalizeMessage);
}

/** Close a deal room (both sides become read-only). PUT, optional reason. */
export async function closeDealRoom(id: string, reason?: string): Promise<void> {
  await api.put(API_ENDPOINTS.DEAL_ROOM_CLOSE(id), reason ? { reason } : {});
}

/** Download the deal room's full export — the backend streams an `application/zip`
 *  attachment (chat transcripts + media organized by stage). We fetch it as a Blob and
 *  save it via a temporary object URL. The filename comes from the `Content-Disposition`
 *  header, falling back to a stable name. GET /deal-rooms/:id/export. */
export async function exportDealRoom(id: string): Promise<void> {
  const res = await api.get(API_ENDPOINTS.DEAL_ROOM_EXPORT(id), { responseType: "blob" });
  const blob = res.data as Blob;

  const disposition = (res.headers["content-disposition"] as string | undefined) ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const fileName = match ? decodeURIComponent(match[1]) : `deal-room-${id}-export.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Raw pending stage-request row (Bridge-Server `DealRoomStageRequest`). */
interface RawStageRequest {
  id: number | string;
  requested_stage: string;
  /** UUID of the user who requested the stage change. */
  requested_by_user_id: string;
}

/** The room's currently pending stage-update request, if any. GET — used on load so a
 *  refresh doesn't lose a request that's awaiting a response (the request/respond
 *  themselves are socket-only, see useDealRoomSocket). */
export async function fetchPendingStageRequest(dealRoomId: string): Promise<DealStageRequest | null> {
  const { data } = await api.get<{ data?: RawStageRequest | null }>(
    API_ENDPOINTS.DEAL_ROOM_STAGE_REQUEST_PENDING(dealRoomId),
  );
  const raw = data.data;
  if (!raw) return null;
  return { id: String(raw.id), requestedStage: raw.requested_stage, requestedByUserId: raw.requested_by_user_id };
}

/**
 * Send a file/media message. POST multipart (`media` file + optional `caption`). The
 * server persists + uploads to S3 and broadcasts `new_message` to the room (incl. the
 * sender), so the message renders via the socket handler — no need to append the return.
 */
export async function sendDealMedia(
  id: string,
  file: File,
  caption?: string,
  downloadAllowed = false,
): Promise<void> {
  const form = new FormData();
  form.append("media", file);
  if (caption?.trim()) form.append("caption", caption.trim());
  // Per-file permission. Every shared file is always viewable, so view_only is always
  // true; "Allow download" is an ADDITIONAL grant on top (view AND download), so it does
  // NOT flip view_only off. Multipart fields are strings → server reads "true"/"false".
  form.append("view_only", "true");
  form.append("download_allowed", String(downloadAllowed));
  // Content-Type undefined so the browser sets multipart/form-data WITH the boundary
  // (a fixed string would omit it and the server's multer couldn't parse) — same pattern
  // as file.service.ts.
  await api.post(API_ENDPOINTS.DEAL_ROOM_SEND_MEDIA(id), form, {
    headers: { "Content-Type": undefined },
  });
}

/** One file shown in the shared-files drawer (mapped from the files-list endpoint). */
export interface SharedFileItem {
  messageId: string;
  name: string;
  /** Size in bytes. */
  size: number;
  kind: "image" | "file";
  s3Key?: string;
  mimeType?: string;
  downloadAllowed: boolean;
  /** Display label for who shared it, e.g. "You" or the counterparty name. */
  by: string;
  /** ISO timestamp. */
  at: string;
  /** Friendly created-at label, e.g. "Jul 10, 9:36 AM". */
  atLabel: string;
  stage?: string;
}

/** One raw file row from the files-list endpoint (tolerant shape — the list endpoint may
 *  use slightly different field names than `/messages`, so we read a few alternates). */
interface RawSharedFile {
  id?: number | string;
  message_id?: number | string;
  /** UUID of the sender user. */
  sender_user_id?: string;
  attachment_file_name?: string | null;
  file_name?: string | null;
  attachment_file_size?: number | null;
  file_size?: number | null;
  attachment_s3_key?: string | null;
  s3_key?: string | null;
  attachment_mime_type?: string | null;
  mime_type?: string | null;
  download_allowed?: boolean | string | null;
  view_only?: boolean | string | null;
  created_at?: string;
  sender?: { id?: string; first_name?: string; last_name?: string } | null;
  stage?: string | null;
}

/** Map a raw files-list row into a UI SharedFileItem. */
function toSharedFile(raw: RawSharedFile): SharedFileItem {
  const me = getCurrentUserId();
  // Both me and raw.sender_user_id are now UUID strings.
  const mine = me != null && raw.sender_user_id === me;
  const mime = raw.attachment_mime_type ?? raw.mime_type ?? undefined;
  const s3Key = raw.attachment_s3_key ?? raw.s3_key ?? undefined;
  return {
    messageId: String(raw.message_id ?? raw.id ?? ""),
    name: raw.attachment_file_name ?? raw.file_name ?? "file",
    size: raw.attachment_file_size ?? raw.file_size ?? 0,
    kind: mime?.startsWith("image/") ? "image" : "file",
    ...(s3Key ? { s3Key } : {}),
    ...(mime ? { mimeType: mime } : {}),
    downloadAllowed: readDownloadAllowed(raw as unknown as Record<string, unknown>),
    by: mine ? "You" : fullName(raw.sender?.first_name, raw.sender?.last_name) || "—",
    at: raw.created_at ?? "",
    atLabel: raw.created_at
      ? new Date(raw.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "",
    ...(raw.stage ? { stage: raw.stage } : {}),
  };
}

/** List every file shared in a deal room (shared-files drawer). GET. */
export async function fetchDealRoomFiles(id: string): Promise<SharedFileItem[]> {
  const { data } = await api.get<{ data?: RawSharedFile[] }>(API_ENDPOINTS.DEAL_ROOM_FILES(id));
  return (data.data ?? []).map(toSharedFile).filter((f) => f.messageId !== "");
}

/** Body for `POST /meetings`. */
export interface ScheduleMeetingPayload {
  dealRoomId: string;
  /** UUID of the recipient user. */
  recipientUserId: string;
  title: string;
  agenda: string;
  meetingLink: string;
  /** ISO timestamp. */
  scheduledAt: string;
  duration: string;
}

/** Body for `PUT /meetings/update` — any subset of the editable fields. */
export interface UpdateMeetingPayload {
  title?: string;
  agenda?: string;
  meetingLink?: string;
  /** ISO timestamp. */
  scheduledAt?: string;
  duration?: string;
}

/** Raw meeting row as returned by the meetings endpoints (tolerant of naming variants).
 *  Also matches the `meeting_scheduled` socket broadcast payload — exported for the
 *  socket handler to reuse via `toScheduledMeeting`. */
export interface RawMeeting {
  id?: number | string;
  meeting_id?: number | string;
  meetingId?: number | string;
  title?: string;
  agenda?: string;
  meeting_link?: string;
  meetingLink?: string;
  scheduled_at?: string;
  scheduledAt?: string;
  duration?: string;
  /** UUID of the user who created the meeting. */
  created_by?: string;
  createdBy?: string;
  created_at?: string;
  createdAt?: string;
  requester_user_first_name?: string;
  requester_user_last_name?: string;
  requesterUserFirstName?: string;
  requesterUserLastName?: string;
}

/** Pull the meeting array out of a response body, tolerant of the exact envelope shape:
 *  `data: [...]`, a bare array, a nested `data: { meetings/rows/items: [...] }`, or (as
 *  `/meetings/upcoming` actually does) `data: { ...a single meeting row... }`. */
function extractMeetingsArray(body: unknown): RawMeeting[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as RawMeeting[];
    if (obj.data && typeof obj.data === "object") {
      const nested = obj.data as Record<string, unknown>;
      for (const key of ["meetings", "rows", "items", "results"]) {
        if (Array.isArray(nested[key])) return nested[key] as RawMeeting[];
      }
      // A single meeting object, e.g. GET /meetings/upcoming returns just the next one.
      if ("id" in nested || "title" in nested) return [nested as RawMeeting];
    }
  }
  return [];
}

/** Map a raw meeting row into the UI shape. `fallback` fills in gaps for a POST/PUT
 *  response that only echoes back a partial row. Exported so the socket handler can
 *  reuse it for the `meeting_scheduled` broadcast (same shape as the REST responses). */
export function toScheduledMeeting(
  raw: RawMeeting,
  fallback: Partial<ScheduleMeetingPayload> & { createdByMe?: boolean } = {}
): ScheduledMeeting {
  const scheduledAt = raw.scheduled_at ?? raw.scheduledAt ?? fallback.scheduledAt ?? "";
  const createdAt = raw.created_at ?? raw.createdAt ?? "";
  const createdBy = raw.created_by ?? raw.createdBy;
  // Both createdBy and getCurrentUserId() are now UUID strings.
  const createdByMe = createdBy != null ? createdBy === getCurrentUserId() : (fallback.createdByMe ?? false);
  const requesterName = [
    raw.requester_user_first_name ?? raw.requesterUserFirstName,
    raw.requester_user_last_name ?? raw.requesterUserLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: String(raw.id ?? raw.meeting_id ?? raw.meetingId ?? `m-${Date.now()}`),
    title: raw.title ?? fallback.title ?? "",
    when: scheduledAt
      ? new Date(scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "",
    scheduledAt,
    createdAtLabel: createdAt
      ? new Date(createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "",
    createdAt,
    requesterName,
    duration: raw.duration ?? fallback.duration ?? "",
    link: raw.meeting_link ?? raw.meetingLink ?? fallback.meetingLink ?? "",
    agenda: raw.agenda ?? fallback.agenda ?? "",
    createdByMe,
  };
}

/** Schedule a meeting inside a deal room. POST /meetings. */
export async function scheduleMeeting(payload: ScheduleMeetingPayload): Promise<ScheduledMeeting> {
  const { data } = await api.post<{ data?: RawMeeting }>(API_ENDPOINTS.MEETING_CREATE, payload);
  return toScheduledMeeting(data.data ?? {}, { ...payload, createdByMe: true });
}

/** Upcoming meetings for a deal room (panel's inline preview). GET /meetings/upcoming. */
export async function fetchUpcomingMeetings(dealRoomId: string): Promise<ScheduledMeeting[]> {
  const { data } = await api.get<unknown>(API_ENDPOINTS.MEETINGS_UPCOMING(dealRoomId));
  return extractMeetingsArray(data).map((raw) => toScheduledMeeting(raw));
}

/** Every meeting for a deal room ("View All" drawer). GET /meetings. */
export async function fetchAllMeetings(dealRoomId: string): Promise<ScheduledMeeting[]> {
  const { data } = await api.get<unknown>(API_ENDPOINTS.MEETINGS_LIST(dealRoomId));
  return extractMeetingsArray(data).map((raw) => toScheduledMeeting(raw));
}

/** A single meeting's full detail (details modal). GET /meetings/detail. */
export async function fetchMeetingDetail(meetingId: string): Promise<ScheduledMeeting> {
  const { data } = await api.get<{ data?: RawMeeting }>(API_ENDPOINTS.MEETING_DETAIL(meetingId));
  return toScheduledMeeting(data.data ?? {});
}

/** Update a meeting (partial). PUT /meetings/update. */
export async function updateMeeting(meetingId: string, payload: UpdateMeetingPayload): Promise<ScheduledMeeting> {
  const { data } = await api.put<{ data?: RawMeeting }>(API_ENDPOINTS.MEETING_UPDATE(meetingId), payload);
  return toScheduledMeeting(data.data ?? {}, { ...payload, createdByMe: true });
}

// ---- Funding Offer (Stage 2: Negotiation) ----------------------------------------
// Backend does not exist yet — fetchCurrentFundingOffer is a placeholder GET that
// fails soft (returns null) until Bridge-Server implements it. Create/Accept/Reject/
// Counter are socket-only (see useDealRoomSocket.ts) — never REST POSTs.

/** A joined user reference on an offer row (`offeredBy` / `recipient` / `respondedBy`). */
interface RawOfferUser {
  /** UUID of the user. */
  id: string;
  first_name?: string;
  last_name?: string;
}

/** Raw funding-offer row — the same shape as the `funding_offer_created` socket
 *  broadcast, reused here so normalizeFundingOffer serves both. */
export interface RawFundingOffer {
  id: number | string;
  status: FundingOfferStatus;
  /** UUID of the user who made the offer. */
  offered_by_user_id: string;
  /** UUID of the recipient user. */
  recipient_user_id: string;
  investment_amount: number | string;
  currency: string;
  equity_percentage: number | string;
  valuation_type: ValuationType;
  valid_until: string;
  terms_conditions?: string | null;
  supporting_notes?: string | null;
  parent_offer_id?: number | string | null;
  root_offer_id?: number | string | null;
  is_counter_offer?: boolean;
  version: number;
  created_at: string;
  sent_at?: string;
  /** UUID of the user who responded; null when pending. */
  responded_by_user_id?: string | null;
  responded_at?: string | null;
  offeredBy?: RawOfferUser | null;
  recipient?: RawOfferUser | null;
  respondedBy?: RawOfferUser | null;
}

/** Normalize a raw offer row — exported so useDealRoomSocket.ts's broadcast handlers reuse it. */
export function normalizeFundingOffer(raw: RawFundingOffer): DealFundingOffer {
  return {
    id: String(raw.id),
    status: raw.status,
    createdByUserId: raw.offered_by_user_id,
    offeredByName: fullName(raw.offeredBy?.first_name, raw.offeredBy?.last_name),
    recipientUserId: raw.recipient_user_id,
    recipientName: fullName(raw.recipient?.first_name, raw.recipient?.last_name),
    amount: Number(raw.investment_amount),
    currency: raw.currency,
    equityPercent: Number(raw.equity_percentage),
    valuationType: raw.valuation_type,
    validUntil: raw.valid_until,
    ...(raw.terms_conditions ? { terms: raw.terms_conditions } : {}),
    ...(raw.supporting_notes ? { notes: raw.supporting_notes } : {}),
    parentOfferId: raw.parent_offer_id != null ? String(raw.parent_offer_id) : null,
    isCounterOffer: !!raw.is_counter_offer,
    rootOfferId: raw.root_offer_id != null ? String(raw.root_offer_id) : null,
    version: raw.version,
    createdAt: raw.created_at,
    sentAt: raw.sent_at,
    ...(raw.responded_by_user_id != null ? { respondedByUserId: raw.responded_by_user_id } : {}),
    ...(raw.respondedBy ? { respondedByName: fullName(raw.respondedBy.first_name, raw.respondedBy.last_name) } : {}),
    respondedAt: raw.responded_at ?? null,
  };
}

/** The currently actionable funding offer for a room — the live Pending row if a
 *  negotiation is underway, else the latest row (Accepted/Rejected/Draft), or null if
 *  none exists yet. GET /deal-rooms/:id/offers/current. */
export async function fetchCurrentFundingOffer(dealRoomId: string): Promise<DealFundingOffer | null> {
  const { data } = await api.get<{ data?: RawFundingOffer | null }>(
    API_ENDPOINTS.DEAL_ROOM_FUNDING_OFFER_CURRENT(dealRoomId),
  );
  return data.data ? normalizeFundingOffer(data.data) : null;
}

/** Every negotiation thread this room has ever had (oldest → newest overall), including
 *  earlier resolved (Accepted/Rejected) rounds a later thread superseded — powers the
 *  "Negotiation History" section of FundingOffersDrawer. GET /deal-rooms/:id/offers/all. */
export async function fetchAllFundingOfferThreads(dealRoomId: string): Promise<DealFundingOffer[]> {
  const { data } = await api.get<{ data?: RawFundingOffer[] }>(
    API_ENDPOINTS.DEAL_ROOM_FUNDING_OFFER_ALL_THREADS(dealRoomId),
  );
  return (data.data ?? []).map(normalizeFundingOffer);
}

// ---- B2B Term Sheet (Stage 2: Negotiation, B2B ↔ B2B only) -----------------------
// Same split as Funding Offer above: Save goes over the socket (see
// useDealRoomSocket.ts's updateTermSheet) — never a REST POST — while these reads are
// plain GETs.

/** A joined user reference on a term-sheet row (`updatedBy`). */
interface RawTermSheetUser {
  /** UUID of the user. */
  id: string;
  first_name?: string;
  last_name?: string;
}

/** Raw term-sheet row — the same shape as the `term_sheet_updated` socket broadcast. */
export interface RawB2BTermSheet {
  id: number | string;
  version: number;
  moq_quantity: number;
  moq_unit: string;
  unit_price: number;
  currency: string;
  payment_terms: string;
  supply_logistics_terms: string;
  /** UUID of the user who last updated the term sheet. */
  updated_by_user_id: string;
  updated_at: string;
  updatedBy?: RawTermSheetUser | null;
}

/** Normalize a raw term-sheet row — exported so useDealRoomSocket.ts's handlers reuse it. */
export function normalizeTermSheet(raw: RawB2BTermSheet): B2BTermSheet {
  return {
    id: String(raw.id),
    version: raw.version,
    moqQuantity: raw.moq_quantity,
    moqUnit: raw.moq_unit,
    unitPrice: raw.unit_price,
    currency: raw.currency,
    paymentTerms: raw.payment_terms,
    supplyLogisticsTerms: raw.supply_logistics_terms,
    updatedByUserId: raw.updated_by_user_id,
    updatedByName: fullName(raw.updatedBy?.first_name, raw.updatedBy?.last_name),
    updatedAt: raw.updated_at,
  };
}

/** The current term sheet for a room, if any. GET /deal-rooms/:id/term-sheet/current. */
export async function fetchCurrentTermSheet(dealRoomId: string): Promise<B2BTermSheet | null> {
  const { data } = await api.get<{ data?: RawB2BTermSheet | null }>(
    API_ENDPOINTS.DEAL_ROOM_TERM_SHEET_CURRENT(dealRoomId),
  );
  return data.data ? normalizeTermSheet(data.data) : null;
}

/** Every saved version, oldest → newest ("View All" history drawer).
 *  GET /deal-rooms/:id/term-sheet/history. */
export async function fetchTermSheetHistory(dealRoomId: string): Promise<B2BTermSheet[]> {
  const { data } = await api.get<{ data?: RawB2BTermSheet[] }>(
    API_ENDPOINTS.DEAL_ROOM_TERM_SHEET_HISTORY(dealRoomId),
  );
  return (data.data ?? []).map(normalizeTermSheet);
}