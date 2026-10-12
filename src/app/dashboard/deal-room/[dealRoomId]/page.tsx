"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { isUserRole } from "@/lib/roles";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/common/loader";
import { DealRoomChat } from "@/components/dashboard/deal-room/DealRoomChat";
import {
  closeDealRoom,
  fetchDealRoom,
  fetchDealRoomMessages,
  fetchPendingStageRequest,
  sendDealMedia,
} from "@/services/deal-room.service";
import { DEAL_STAGES, nextStageValue } from "@/components/dashboard/deal-room/deal-room-meta";
import { useDealRoomSocket } from "@/lib/useDealRoomSocket";
import { getCurrentUserId } from "@/lib/jwt";
import type {
  B2BTermSheet,
  DealFundingOffer,
  DealMessage,
  DealRoom,
  DealStageRequest,
  FundingOfferFormValues,
  ScheduledMeeting,
  TermSheetFormValues,
  ValuationType,
} from "@/components/dashboard/deal-room/types";
import type { ApiError } from "@/lib/axios";

/**
 * Live Deal Room chat — dynamic route /dashboard/deal-room/[dealRoomId]. Loads the room
 * meta + message history over REST, then streams live messages over the socket. TEXT
 * sends go over the socket (`send_message`); the server echoes them back via
 * `new_message`, so we append there (no optimistic double). Renders the shared,
 * presentational `DealRoomChat`.
 *
 * Deferred (later pass): file/media messages (multipart upload + authenticated download),
 * read receipts, typing indicators.
 */
export default function DealRoomChatPage({ params }: { params: Promise<{ dealRoomId: string }> }) {
  const { dealRoomId } = use(params);
  const router = useRouter();
  const { role, isLoaded } = useAuth();
  const [room, setRoom] = useState<DealRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toastedStageRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isUserRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  // `quiet` re-syncs without the full-page loader (used on socket reconnect).
  const load = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    Promise.all([
      fetchDealRoom(dealRoomId),
      fetchDealRoomMessages(dealRoomId),
      // Non-critical: don't fail the whole page load if this lookup errors.
      fetchPendingStageRequest(dealRoomId).catch(() => null),
    ])
      .then(([meta, messages, pendingStageRequest]) => {
        if (!meta) {
          setError("This deal room doesn't exist.");
          return;
        }
        setRoom({ ...meta, messages, pendingStageRequest });
      })
      .catch(() => setError("Couldn't load this deal room. Please try again."))
      .finally(() => setLoading(false));
  }, [dealRoomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() drives loading state
    if (isLoaded && isUserRole(role)) load();
  }, [isLoaded, role, load]);

  // Whether the counterparty is currently typing.
  const [counterpartyTyping, setCounterpartyTyping] = useState(false);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether the counterparty currently has this deal room open (see onPresenceChange below).
  const [counterpartyOnline, setCounterpartyOnline] = useState(false);

  // Bumped whenever a `new_message` socket event carries a file attachment (mine or the
  // counterparty's), so the side panel's Shared Files preview refetches live — otherwise
  // it only refetches on room.stage change, so a file shared while already on a stage
  // never appeared until the stage changed or the page was reloaded.
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);

  // Append inbound (and self-echoed) socket messages, de-duplicated by id. A fresh
  // message of mine is delivered-but-unread (single tick) until a `messages_read` arrives.
  const onNewMessage = useCallback((msg: DealMessage) => {
    setRoom((prev) =>
      prev && !prev.messages.some((m) => m.id === msg.id)
        ? { ...prev, messages: [...prev.messages, msg] }
        : prev,
    );
    // Their new message means they're clearly not just-typing anymore.
    if (msg.sender === "them") setCounterpartyTyping(false);
    if (msg.attachment) setFilesRefreshKey((k) => k + 1);
  }, []);

  // The counterparty read the room → mark all MY messages as seen (double blue tick).
  // (mark_read sets read_at on every message where I'm the sender.)
  const onMessagesRead = useCallback((payload: { readBy: string }) => {
    if (payload.readBy === getCurrentUserId()) return;
    setRoom((prev) =>
      prev
        ? { ...prev, messages: prev.messages.map((m) => (m.sender === "me" && !m.read ? { ...m, read: true } : m)) }
        : prev,
    );
  }, []);

  // The other side started/stopped typing. Auto-clear as a safety net if a stop event
  // is ever missed.
  const onUserTyping = useCallback((payload: { userId: string; typing: boolean }) => {
    if (payload.userId === getCurrentUserId()) return;
    setCounterpartyTyping(payload.typing);
    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    if (payload.typing) {
      // Safety net if a `stop_typing` is ever missed. Kept comfortably longer than the
      // sender's ~2s typing heartbeat so an in-flight/late heartbeat can't flicker it off.
      typingClearRef.current = setTimeout(() => setCounterpartyTyping(false), 6000);
    }
  }, []);

  // The counterparty opened/closed this deal room (server sends the current status right
  // after we join, then pushes updates as they join/leave/disconnect).
  const onPresenceChange = useCallback((payload: { userId: string; online: boolean }) => {
    if (payload.userId === getCurrentUserId()) return;
    setCounterpartyOnline(payload.online);
  }, []);

  // A fresh room (or a disconnect) starts from a clean "offline" slate — the server will
  // re-announce the real status once the socket (re)joins.
  useEffect(() => {
    setCounterpartyOnline(false);
  }, [dealRoomId]);

  // const { sendMessage, notifyTyping, stopTyping } = useDealRoomSocket(room ? dealRoomId : "", {
  //   onNewMessage,
  //   onMessagesRead,
  //   onUserTyping,
  //   onPresenceChange,
  // });
  // Either side requested a stage change (including my own request, echoed back) → show
  // it in the side panel (Accept/Reject for them, "Request Pending…" for me).
  const onStageRequested = useCallback((request: DealStageRequest) => {
    setRoom((prev) => (prev ? { ...prev, pendingStageRequest: request } : prev));
    if (request.requestedByUserId === getCurrentUserId()) {
      toast.success("Your request to move to the next stage has been sent.");
    }
  }, []);
  useEffect(() => {
    const pending = room?.pendingStageRequest;
    if (
      pending &&
      pending.requestedByUserId !== getCurrentUserId() &&
      toastedStageRequestRef.current !== pending.id
    ) {
      toastedStageRequestRef.current = pending.id;
      toast("You have a pending stage-change request awaiting your response.");
    }
  }, [room?.pendingStageRequest]);

  // The pending request was accepted/rejected — clear it, and on accept advance the
  // stepper to the room's new stage.
  const onStageResponded = useCallback(
    (payload: { requestId: string; decision: "Accepted" | "Rejected"; newStageIndex?: number }) => {
      setRoom((prev) => {
        if (!prev || prev.pendingStageRequest?.id !== payload.requestId) return prev;
        return {
          ...prev,
          pendingStageRequest: null,
          stage: payload.newStageIndex ?? prev.stage,
        };
      });
      if (payload.decision === "Rejected") toast.error("Stage change request was rejected.");
      else toast.success("Deal moved to the next stage.");
    },
    [],
  );

  // Either side scheduled a meeting (including my own, echoed back) — bump a counter so
  // the side panel's "Upcoming Meetings" list refetches live, and toast the counterparty
  // (my own scheduling already gets a toast from the schedule form itself).
  const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0);
  const onMeetingScheduled = useCallback((meeting: ScheduledMeeting) => {
    setMeetingsRefreshKey((k) => k + 1);
    if (!meeting.createdByMe) toast.success(`New meeting scheduled: ${meeting.title}`);
  }, []);

  // Either side sends/counters a funding offer (including my own, echoed back) — bump a
  // counter so the side panel's Funding Offer card refetches live.
  const [fundingOfferRefreshKey, setFundingOfferRefreshKey] = useState(0);
  const onFundingOfferCreated = useCallback((offer: DealFundingOffer) => {
    setFundingOfferRefreshKey((k) => k + 1);
    if (offer.createdByUserId !== getCurrentUserId()) {
      toast.success(offer.parentOfferId ? "You received a counter-offer." : "You received a new funding offer.");
    }
  }, []);
  const onFundingOfferResponded = useCallback((payload: { offerId: string; decision: "Accepted" | "Rejected" }) => {
    setFundingOfferRefreshKey((k) => k + 1);
    if (payload.decision === "Accepted") toast.success("Funding offer accepted.");
    else toast.error("Funding offer rejected.");
  }, []);

  // Either side saves an edit to the B2B term sheet (including my own, echoed back) —
  // bump a counter so the side panel's B2B Term Sheet card refetches live.
  const [termSheetRefreshKey, setTermSheetRefreshKey] = useState(0);
  const onTermSheetUpdated = useCallback((sheet: B2BTermSheet) => {
    setTermSheetRefreshKey((k) => k + 1);
    if (sheet.updatedByUserId !== getCurrentUserId()) toast.success("The B2B term sheet was updated.");
  }, []);

  const {
    sendMessage,
    notifyTyping,
    stopTyping,
    requestNextStage,
    respondStageUpdate,
    createFundingOffer,
    respondFundingOffer,
    counterFundingOffer,
    updateTermSheet,
  } = useDealRoomSocket(room ? dealRoomId : "", {
    onNewMessage,
    onMessagesRead,
    onReconnect: () => load(true),
    onUserTyping,
    onStageRequested,
    onStageResponded,
    onPresenceChange,
    onMeetingScheduled,
    onFundingOfferCreated,
    onFundingOfferResponded,
    onTermSheetUpdated,
  });

  if (!isLoaded || !isUserRole(role)) return null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-24">
        <Loader size={28} />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Icon name="error" size={40} className="text-on-surface-variant" />
        <p className="text-sm text-on-surface-variant">{error ?? "This deal room doesn't exist."}</p>
        <div className="flex gap-2">
          {error && (
            <Button onClick={() => load()} variant="secondary" leadingIcon="refresh">
              Retry
            </Button>
          )}
          <Button href="/dashboard/deal-room" variant="secondary" leadingIcon="arrow_back">
            Back to Deal Rooms
          </Button>
        </div>
      </div>
    );
  }

  // TEXT goes over the socket; a FILE is uploaded via REST. Either way the server
  // broadcasts `new_message` back to the room, so the message renders through the socket
  // handler (no optimistic append / no double).
  const onSendMessage = (text: string, file?: File, downloadAllowed?: boolean) => {
    if (file) {
      sendDealMedia(dealRoomId, file, text, downloadAllowed).catch((err) => {
        toast.error((err as ApiError).message ?? "Couldn't send the file. Please try again.");
      });
    } else {
      sendMessage(text);
    }
  };

  const onCloseDeal = async (reason: string) => {
    try {
      await closeDealRoom(dealRoomId, reason);
      setRoom({ ...room, status: "CLOSED" });
      toast.success("Deal closed.");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't close the deal. Please try again.");
      throw err;
    }
  };

  const onRequestNextStage = () => {
    const requestedStage = nextStageValue(room.stage);
    if (!requestedStage) return; // already on the last stage
    requestNextStage(requestedStage);
  };

  const onAcceptStage = () => {
    if (room.pendingStageRequest) respondStageUpdate(room.pendingStageRequest.id, "Accepted");
  };

  const onRejectStage = () => {
    if (room.pendingStageRequest) respondStageUpdate(room.pendingStageRequest.id, "Rejected");
  };

  const fundingOfferPayload = (values: FundingOfferFormValues) => ({
    amount: Number(values.amount),
    currency: values.currency,
    equityPercent: Number(values.equityPercent),
    valuationType: values.valuationType as ValuationType,
    validUntil: values.validUntil,
    ...(values.terms.trim() ? { terms: values.terms.trim() } : {}),
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  });

  const onSendFundingOffer = (values: FundingOfferFormValues) => createFundingOffer(fundingOfferPayload(values));
  const onAcceptFundingOffer = (offerId: string) => respondFundingOffer(offerId, "Accepted");
  const onRejectFundingOffer = (offerId: string) => respondFundingOffer(offerId, "Rejected");
  const onCounterFundingOffer = (offerId: string, values: FundingOfferFormValues) =>
    counterFundingOffer(offerId, fundingOfferPayload(values));

  const onSaveTermSheet = (values: TermSheetFormValues) =>
    updateTermSheet({
      moqQuantity: Number(values.moqQuantity),
      moqUnit: values.moqUnit,
      unitPrice: Number(values.unitPrice),
      currency: values.currency,
      paymentTerms: values.paymentTerms,
      supplyLogisticsTerms: values.supplyLogisticsTerms,
    });

  return (
    <DealRoomChat
      room={room}
      backHref="/dashboard/deal-room"
      onSendMessage={onSendMessage}
      onCloseDeal={onCloseDeal}
      counterpartyTyping={counterpartyTyping}
      onTyping={notifyTyping}
      onStopTyping={stopTyping}
      counterpartyOnline={counterpartyOnline}
      isLastStage={room.stage >= DEAL_STAGES.length - 1}
      meetingsRefreshKey={meetingsRefreshKey}
      filesRefreshKey={filesRefreshKey}
      onRequestNextStage={onRequestNextStage}
      onAcceptStage={onAcceptStage}
      onRejectStage={onRejectStage}
      fundingOfferRefreshKey={fundingOfferRefreshKey}
      onSendFundingOffer={onSendFundingOffer}
      onAcceptFundingOffer={onAcceptFundingOffer}
      onRejectFundingOffer={onRejectFundingOffer}
      onCounterFundingOffer={onCounterFundingOffer}
      termSheetRefreshKey={termSheetRefreshKey}
      onSaveTermSheet={onSaveTermSheet}
    />
  );
}
