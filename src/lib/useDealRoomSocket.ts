"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  normalizeFundingOffer,
  normalizeMessage,
  normalizeTermSheet,
  toScheduledMeeting,
  type RawFundingOffer,
  type RawMessage,
} from "@/services/deal-room.service";
import { stageIndexFromValue } from "@/components/dashboard/deal-room/deal-room-meta";
import type {
  B2BTermSheet,
  DealFundingOffer,
  DealMessage,
  DealStageRequest,
  ScheduledMeeting,
  ValuationType,
} from "@/components/dashboard/deal-room/types";

/** Payload for the server's `messages_read` broadcast. */
export interface MessagesReadPayload {
  dealRoomId: string;
  readBy: string;
}
/** Payload for the server's `user_typing` broadcast. */
export interface UserTypingPayload {
  dealRoomId: string;
  userId: string;
  typing: boolean;
}
/** Payload for the server's `user_presence` broadcast. `online` means that user currently
 *  has this deal room open in another tab/socket — presence is scoped to this room, not a
 *  global "logged in anywhere" signal. */
export interface UserPresencePayload {
  userId: string;
  online: boolean;
}
/** Raw `stage_update_requested` broadcast (Bridge-Server's `DealRoomStageRequest` row). */
interface RawStageRequested {
  id: number | string;
  requested_stage: string;
  requested_by_user_id: string;
}
/** Raw `stage_update_responded` broadcast: the responded-to request + the room's new
 *  stage (only present when the decision was "Accepted"). */
interface RawStageResponded {
  request: { id: number | string; status: "Accepted" | "Rejected"; requested_by_user_id: string };
  dealRoom: { stage: string };
}
/** Decision passed to `respondStageUpdate`. */
export type StageDecision = "Accepted" | "Rejected";

/** Payload for creating or countering a funding offer (the recipient is derived
 *  server-side from the deal room's investor/startup pair — not sent). */
export interface FundingOfferEmitPayload {
  amount: number;
  currency: string;
  equityPercent: number;
  valuationType: ValuationType;
  validUntil: string;
  terms?: string;
  notes?: string;
}

/** Translate the frontend-friendly emit payload into Bridge-Server's `deal_room_offer`
 *  wire field names (investmentAmount/equityPercentage/termsConditions/supportingNotes). */
function toOfferWirePayload(payload: FundingOfferEmitPayload) {
  return {
    currency: payload.currency,
    investmentAmount: payload.amount,
    equityPercentage: payload.equityPercent,
    valuationType: payload.valuationType,
    validUntil: payload.validUntil,
    ...(payload.terms ? { termsConditions: payload.terms } : {}),
    ...(payload.notes ? { supportingNotes: payload.notes } : {}),
  };
}

/** Raw `term_sheet_updated` broadcast (B2B collaborative term sheet — no accept/reject,
 *  a save just broadcasts the new snapshot to both sides). */
export interface RawB2BTermSheet {
  id: number | string;
  version: number;
  moq_quantity: number;
  moq_unit: string;
  unit_price: number;
  currency: string;
  payment_terms: string;
  supply_logistics_terms: string;
  updated_by_user_id: string;
  updated_at: string;
}
/** Payload for saving a term sheet edit (either B2B party may call this). */
export interface TermSheetEmitPayload {
  moqQuantity: number;
  moqUnit: string;
  unitPrice: number;
  currency: string;
  paymentTerms: string;
  supplyLogisticsTerms: string;
}

interface DealRoomSocketHandlers {
  onNewMessage: (msg: DealMessage) => void;
  /** Fired when someone marks the room read (used for "Seen" receipts). */
  onMessagesRead?: (payload: MessagesReadPayload) => void;
  onReconnect?: () => void;
  /** Fired when the other participant starts/stops typing. */
  onUserTyping?: (payload: UserTypingPayload) => void;
  /** Fired when the other participant opens/closes this deal room. */
  onPresenceChange?: (payload: UserPresencePayload) => void;
  /** Fired when either side requests a stage change — including my own request
   *  echoed back, so the "Request Next Stage" button can flip to a pending state. */
  onStageRequested?: (request: DealStageRequest) => void;
  /** Fired once the request is accepted/rejected. `newStageIndex` is only set on accept. */
  onStageResponded?: (payload: { requestId: string; decision: StageDecision; newStageIndex?: number }) => void;
  /** Fired when either side schedules a meeting — including my own echoed back, so
   *  every open tab (mine and the counterparty's) can refresh the meetings list live. */
  onMeetingScheduled?: (meeting: ScheduledMeeting) => void;
  /** Fired when either side sends/counters a funding offer — including my own, echoed back. */
  onFundingOfferCreated?: (offer: DealFundingOffer) => void;
  /** Fired once a pending funding offer is accepted/rejected. */
  onFundingOfferResponded?: (payload: { offerId: string; decision: "Accepted" | "Rejected" }) => void;
  /** Fired whenever either side saves an edit to the B2B term sheet — including my
   *  own, echoed back, so every open tab shows the latest version live. */
  onTermSheetUpdated?: (sheet: B2BTermSheet) => void;
}

/** How long after the LAST keystroke we auto-emit `stop_typing` (indicator lingers this
 *  long once the other person pauses). */
const TYPING_IDLE_MS = 4000;
/** While typing continuously, re-emit `typing` at most this often so the other side's
 *  auto-clear keeps getting refreshed and the indicator never vanishes mid-typing. */
const TYPING_HEARTBEAT_MS = 2000;

/**
 * Deal Room real-time socket (Bridge-Server socket.io). Connects to the API host
 * (NEXT_PUBLIC_API_BASE_URL, NOT the /api/v1 path), authenticating with the JWT in the
 * handshake. Joins one deal room and handles the full event set:
 *
 * - inbound `new_message` → `onNewMessage` (also auto-emits `mark_read` for messages from
 *   the other side while the tab is visible, so they get read receipts);
 * - inbound `messages_read` → `onMessagesRead` (drives our "Seen" indicator);
 * - inbound `user_typing` → `onUserTyping` (drives the "typing…" indicator);
 * - inbound `user_presence` → `onPresenceChange` (drives the online/offline dot — the
 *   server sends the counterparty's current status right after `join_deal_room`, then
 *   pushes updates as they join/leave/disconnect from this room);
 * - inbound `meeting_scheduled` → `onMeetingScheduled` (broadcast by the REST
 *   `POST /meetings` handler right after it commits, so both sides see the new meeting
 *   live without a manual refresh);
 * - `sendMessage(text)` emits `send_message`;
 * - `notifyTyping()` / `stopTyping()` emit `typing` / `stop_typing` (throttled — one
 *   `typing` per burst, auto `stop_typing` after {@link TYPING_IDLE_MS} idle).
 *
 * The server broadcasts `new_message` to EVERYONE in the room including the sender, so a
 * sent message comes back through `onNewMessage` — the caller dedupes by message id.
 */
export function useDealRoomSocket(dealRoomId: string, handlers: DealRoomSocketHandlers) {
  const socketRef = useRef<Socket | null>(null);

  // Keep the latest callbacks without forcing a reconnect when they change.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Typing throttle state: whether a `typing` is currently "open", the idle timer, and
  // the timestamp of the last `typing` emit (for the heartbeat).
  const typingActiveRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);

  // socket.io retries the connection automatically (default behavior) — without this,
  // a persistent auth/CORS failure would re-fire connect_error every retry and spam
  // the toast. Reset to false on a successful connect so a later failure (e.g. after
  // the cookie expires mid-session) can surface again.
  const connectErrorShownRef = useRef(false);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    if (!dealRoomId) return;

    // The access token is an httpOnly cookie now — withCredentials makes the browser
    // attach it to the socket.io handshake automatically (server reads it from the
    // handshake's Cookie header); there's no token for JS to read or pass explicitly.
    const url = process.env.NEXT_PUBLIC_API_BASE_URL || undefined;
    const socket = io(url, { withCredentials: true, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    // Claim the room as read, but only while the tab is on screen so we never report a
    // message as seen that nobody looked at. Idempotent server-side (only still-unread
    // rows are updated), so it's safe to call liberally.
    const markReadIfVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      socket.emit("mark_read", { dealRoomId });
    };

    socket.on("connect", () => {
      connectErrorShownRef.current = false;
      socket.emit("join_deal_room", { dealRoomId });
      // Opening the room clears any unread messages for me — but an automatic reconnect
      // (network blip, laptop wake) while the tab is hidden must not claim a read.
      markReadIfVisible();

      if (hasConnectedRef.current) handlersRef.current.onReconnect?.();
      hasConnectedRef.current = true;
    });
    // Without this, an auth/CORS failure on the handshake fails completely silently —
    // no console output, no user-visible sign that real-time updates (chat, meetings,
    // file shares, funding offers, term sheets — all share this one connection) aren't
    // working. Surface it once (not on every automatic retry) so a failure is at least
    // visible instead of invisible.
    socket.on("connect_error", (err) => {
      console.error("Deal room socket failed to connect:", err.message);
      if (!connectErrorShownRef.current) {
        connectErrorShownRef.current = true;
        toast.error("Live updates are unavailable — reconnecting…");
      }
    });

    socket.on("new_message", (raw: RawMessage) => {
      const msg = normalizeMessage(raw);
      handlersRef.current.onNewMessage(msg);
      // A message from the other side is read immediately if the tab is on screen. If it
      // isn't, the visibilitychange listener below claims it when the tab comes back.
      if (msg.sender === "them") markReadIfVisible();
    });

    socket.on("messages_read", (payload: MessagesReadPayload) => handlersRef.current.onMessagesRead?.(payload));
    socket.on("user_typing", (payload: UserTypingPayload) => handlersRef.current.onUserTyping?.(payload));
    socket.on("user_presence", (payload: UserPresencePayload) => handlersRef.current.onPresenceChange?.(payload));

    socket.on("stage_update_requested", (raw: RawStageRequested) => {
      handlersRef.current.onStageRequested?.({
        id: String(raw.id),
        requestedStage: raw.requested_stage,
        requestedByUserId: raw.requested_by_user_id,
      });
    });

    socket.on("stage_update_responded", (raw: RawStageResponded) => {
      handlersRef.current.onStageResponded?.({
        requestId: String(raw.request.id),
        decision: raw.request.status,
        ...(raw.request.status === "Accepted" ? { newStageIndex: stageIndexFromValue(raw.dealRoom.stage) } : {}),
      });
    });

    socket.on("meeting_scheduled", (raw: Parameters<typeof toScheduledMeeting>[0]) => {
      handlersRef.current.onMeetingScheduled?.(toScheduledMeeting(raw));
    });

    // A new offer and a counter-offer are both "a new Pending row now exists" — same
    // handler either way (it distinguishes via `offer.parentOfferId` if it needs to).
    socket.on("offer_received", (raw: RawFundingOffer) => {
      handlersRef.current.onFundingOfferCreated?.(normalizeFundingOffer(raw));
    });
    socket.on("offer_countered", (raw: RawFundingOffer) => {
      handlersRef.current.onFundingOfferCreated?.(normalizeFundingOffer(raw));
    });
    socket.on("offer_responded", (raw: RawFundingOffer) => {
      const offer = normalizeFundingOffer(raw);
      handlersRef.current.onFundingOfferResponded?.({
        offerId: offer.id,
        decision: offer.status as "Accepted" | "Rejected",
      });
    });

    socket.on("term_sheet_updated", (raw: RawB2BTermSheet) => {
      handlersRef.current.onTermSheetUpdated?.(normalizeTermSheet(raw));
    });

    socket.on("error", (err: { message?: string }) =>
      toast.error(err?.message ?? "Deal room connection error."),
    );

    // The tab coming back into view is the moment the user actually reads what arrived
    // while it was hidden — without this the sender's tick stays "Delivered" until a
    // reload. Not gated on "did we see an unread message": a backgrounded tab may have
    // been frozen or disconnected when it arrived, so we can't know.
    const onVisibilityChange = () => markReadIfVisible();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      hasConnectedRef.current = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingActiveRef.current = false;
      socket.emit("leave_deal_room", { dealRoomId });
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dealRoomId]);

  /** Send a text message over the socket. */
  const sendMessage = (text: string) => {
    const body = text.trim();
    if (!body) return;
    socketRef.current?.emit("send_message", { dealRoomId, message: body });
  };

  /** Mark all messages in this room as read (drives the other side's "Seen"). */
  const markRead = () => socketRef.current?.emit("mark_read", { dealRoomId });

  /** Tell the other side I stopped typing (idempotent). */
  const stopTyping = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingActiveRef.current) {
      socketRef.current?.emit("stop_typing", { dealRoomId });
      typingActiveRef.current = false;
    }
  };

  /** Call on each keystroke. Emits `typing` on the first keystroke and then as a
   *  heartbeat (≤ every TYPING_HEARTBEAT_MS) so the other side's indicator stays up while
   *  typing; auto-emits `stop_typing` after TYPING_IDLE_MS of no keystrokes. */
  const notifyTyping = () => {
    if (!socketRef.current) return;
    const now = Date.now();
    if (!typingActiveRef.current || now - lastTypingEmitRef.current >= TYPING_HEARTBEAT_MS) {
      socketRef.current.emit("typing", { dealRoomId });
      typingActiveRef.current = true;
      lastTypingEmitRef.current = now;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  /** Ask the counterparty to move the deal to `requestedStage` (a DEAL_STAGE_VALUES
   *  entry). The server broadcasts `stage_update_requested` back to the whole room
   *  (including me), so no optimistic state is set here. */
  const requestNextStage = (requestedStage: string) => {
    socketRef.current?.emit("request_stage_update", { dealRoomId, requestedStage });
  };

  /** Accept/reject a pending stage-update request (only the non-requester may call this
   *  — enforced server-side too). */
  const respondStageUpdate = (requestId: string, decision: StageDecision) => {
    socketRef.current?.emit("respond_stage_update", { dealRoomId, requestId, decision });
  };

  /** Send a NEW funding offer (investor → founder only — enforced server-side). No
   *  optimistic state — the server broadcasts `offer_received` back to the room. */
  const createFundingOffer = (payload: FundingOfferEmitPayload) => {
    socketRef.current?.emit("send_offer", { dealRoomId, ...toOfferWirePayload(payload) });
  };

  /** Accept/reject a pending funding offer (only the recipient may call this —
   *  enforced server-side too). The server broadcasts `offer_responded` back to the room. */
  const respondFundingOffer = (offerId: string, decision: "Accepted" | "Rejected") => {
    socketRef.current?.emit("respond_offer", { dealRoomId, offerId: Number(offerId), decision });
  };

  /** Submit a counter-offer against `parentOfferId` (only the recipient may call this).
   *  The server flips the parent to "Countered", inserts a new Pending row with the
   *  sender/recipient swapped, and broadcasts `offer_countered` back to the room. */
  const counterFundingOffer = (parentOfferId: string, payload: FundingOfferEmitPayload) => {
    socketRef.current?.emit("counter_offer", {
      dealRoomId,
      offerId: Number(parentOfferId),
      ...toOfferWirePayload(payload),
    });
  };

  /** Save an edit to the B2B term sheet (either party). No optimistic state — the
   *  server broadcasts `term_sheet_updated` back to the room. */
  const updateTermSheet = (payload: TermSheetEmitPayload) => {
    socketRef.current?.emit("update_term_sheet", { dealRoomId, ...payload });
  };

  return {
    sendMessage,
    markRead,
    notifyTyping,
    stopTyping,
    requestNextStage,
    respondStageUpdate,
    createFundingOffer,
    respondFundingOffer,
    counterFundingOffer,
    updateTermSheet,
  };
}