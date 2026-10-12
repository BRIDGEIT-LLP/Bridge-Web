"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { ROLE_AVATAR_GRADIENT } from "@/lib/connections";
import { Avatar } from "@/components/ui/Avatar";
import { MessageBubble } from "./MessageBubble";
import { DealStageStepper } from "./DealStageStepper";
import { DealSidePanel } from "./DealSidePanel";
import { CLOSE_DEAL_REASONS, formatLocation, dayLabel, initials } from "./deal-room-meta";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { Modal } from "@/components/modal/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Loader } from "@/components/common/loader";
import { Select } from "@/components/ui/Select";
import { exportDealRoom, archiveDealRoom, unarchiveDealRoom } from "@/services/deal-room.service";
import type { ApiError } from "@/lib/axios";
import type { DealAttachment, DealRoom, FundingOfferFormValues, PreviewableFile, TermSheetFormValues } from "./types";

interface DealRoomChatProps {
  /** The room to render, including its message thread. The parent owns the data source
   *  (REST/socket for the live page, the in-memory store for the demo). */
  room: DealRoom;
  /** Where the back arrow navigates (live vs demo list route). */
  backHref: string;
  /** Send a message: `text` and/or an attached `file`. `downloadAllowed` marks whether the
   *  recipient may download the file (else view-only). The parent persists it (live page
   *  uploads the file / emits the text; demo appends locally). */
  onSendMessage: (text: string, file?: File, downloadAllowed?: boolean) => void;
  /** Close the deal with the chosen reason; the parent flips the room to CLOSED. May be
   *  async (live page persists it via the backend) — rejecting keeps the confirm modal open. */
  onCloseDeal: (reason: string) => void | Promise<void>;
  /** The counterparty is currently typing → show the "typing…" indicator. */
  counterpartyTyping?: boolean;
  /** Call on each composer keystroke (emits `typing`, throttled by the socket hook). */
  onTyping?: () => void;
  /** Call when the draft is sent/cleared (emits `stop_typing`). */
  onStopTyping?: () => void;
  /** Is the counterparty currently online (has this deal room open)? Drives the
   *  status-bar dot + label — sourced from the socket's `user_presence` event via the
   *  parent page. */
  counterpartyOnline?: boolean;
  /** True once the room is on the final pipeline stage — nothing further to request. */
  isLastStage: boolean;
  /** Bumped whenever a `meeting_scheduled` socket event lands, so the side panel's
   *  "Upcoming Meetings" list refetches live. Omit (demo page) to disable this. */
  meetingsRefreshKey?: number;
  /** Bumped whenever a `new_message` socket event carries a file attachment, so the
   *  side panel's Shared Files preview refetches live. Omit (demo page) to disable this. */
  filesRefreshKey?: number;
  /** Ask the counterparty to move to the next stage. */
  onRequestNextStage: () => void;
  /** Accept the counterparty's pending stage-update request. */
  onAcceptStage: () => void;
  /** Reject the counterparty's pending stage-update request. */
  onRejectStage: () => void;
  /** Bumped whenever a funding_offer_created/_responded socket event lands, so the side
   *  panel's Funding Offer card refetches live. Omit (demo page) to disable this. */
  fundingOfferRefreshKey?: number;
  /** Send a brand-new funding offer (investor only). */
  onSendFundingOffer: (values: FundingOfferFormValues) => void | Promise<void>;
  /** Accept the given pending funding offer (recipient only). */
  onAcceptFundingOffer: (offerId: string) => void;
  /** Reject the given pending funding offer (recipient only). */
  onRejectFundingOffer: (offerId: string) => void;
  /** Submit a counter against the given funding offer (recipient only). */
  onCounterFundingOffer: (offerId: string, values: FundingOfferFormValues) => void | Promise<void>;
  /** Bumped whenever a term_sheet_updated socket event lands, so the side panel's
   *  B2B Term Sheet card refetches live. Omit (demo page) to disable this. */
  termSheetRefreshKey?: number;
  /** Save an edit to the B2B term sheet (either party). */
  onSaveTermSheet: (values: TermSheetFormValues) => void | Promise<void>;
}


interface PendingFile {
  name: string;
  size: number;
  kind: DealAttachment["kind"];
  url: string;
  file: File;
  /** Sender's choice: may the recipient download this file? Default false (view-only). */
  downloadAllowed: boolean;
}

/**
 * Presentational workspace for a single deal room — deal header with Close Deal, the
 * 4-stage pipeline stepper, then the chat card (status bar, dated thread, composer) and
 * the side panel. Data-source agnostic: it renders `room` and calls `onSendMessage` /
 * `onCloseDeal`, so the live page (service-backed) and demo page (store-backed) reuse it.
 */
export function DealRoomChat({
  room,
  backHref,
  onSendMessage,
  onCloseDeal,
  counterpartyTyping = false,
  onTyping,
  onStopTyping,
  counterpartyOnline = false,
  isLastStage,
  meetingsRefreshKey,
  filesRefreshKey,
  onRequestNextStage,
  onAcceptStage,
  onRejectStage,
  fundingOfferRefreshKey,
  onSendFundingOffer,
  onAcceptFundingOffer,
  onRejectFundingOffer,
  onCounterFundingOffer,
  termSheetRefreshKey,
  onSaveTermSheet,
}: DealRoomChatProps) {
  const router = useRouter();
  const { counterparty: cp } = room;
  const messages = room.messages;
  const closed = room.status === "CLOSED";
  const location = formatLocation(cp.state, cp.country);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  // The file currently open in the watermarked preview modal (null = closed).
  const [preview, setPreview] = useState<PreviewableFile | null>(null);
  // Side panel open by default; the chat status-bar arrow collapses it to give the
  // chat full width (and expands it back).
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [exporting, setExporting] = useState(false);
  // Per-user archive state — toggles the Archive/Unarchive button. Seeded from the room
  // and re-synced if a different room loads.
  const [archived, setArchived] = useState(!!room.isArchived);
  const [archiving, setArchiving] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the toggle in sync with the loaded room
    setArchived(!!room.isArchived);
  }, [room.id, room.isArchived]);

  // Download the deal room's chats + media as a stage-organized zip
  // (GET /deal-rooms/:id/export, streamed as an attachment).
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportDealRoom(room.id);
      toast.success("Deal room exported.");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't export the deal room.");
    } finally {
      setExporting(false);
    }
  };

  // Archive / unarchive this room for the current user (per-user view). Toggles the
  // button label between "Archive" and "Unarchive".
  const handleToggleArchive = async () => {
    if (archiving) return;
    setArchiving(true);
    try {
      if (archived) {
        await unarchiveDealRoom(room.id);
        setArchived(false);
        toast.success("Deal room unarchived.");
      } else {
        await archiveDealRoom(room.id);
        setArchived(true);
        toast.success("Deal room archived. Find it under the Archived tab.");
      }
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't update the archive state.");
    } finally {
      setArchiving(false);
    }
  };
  const [closing, setClosing] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bring the newest message into view. scrollIntoView on a bottom anchor works whether
  // the thread itself scrolls or (fallback) the outer dashboard container does — so a
  // just-sent message is never left below the fold.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, counterpartyTyping]);

  const pickFile = (file: File) => {
    const kind: DealAttachment["kind"] = file.type.startsWith("image/") ? "image" : "file";
    // Default to view-only; the sender opts into downloads via the composer toggle.
    setPending({ name: file.name, size: file.size, kind, url: URL.createObjectURL(file), file, downloadAllowed: false });
  };

  const send = () => {
    if (closed) return;
    const text = draft.trim();
    if (!text && !pending) return;

    onSendMessage(text, pending?.file, pending?.downloadAllowed);
    setDraft("");
    setPending(null);
    onStopTyping?.();
  };

  // Open the watermarked preview modal for a shared file. Needs a server-side s3Key —
  // just-picked / demo attachments (no upload yet) have none, so they're skipped.
  const openPreview = (file: PreviewableFile) => {
    if (!file.s3Key) {
      toast.error("This file isn't available to preview.");
      return;
    }
    setPreview(file);
  };

  const handleClose = () => {
    if (closed) return;
    setCloseModalOpen(true);
  };

  const dismissCloseModal = () => {
    setCloseModalOpen(false);
    setCloseReason("");
  };

  const handleConfirmClose = async () => {
    if (closing || !closeReason) return;
    setClosing(true);
    try {
      await onCloseDeal(closeReason);
      dismissCloseModal();
    } catch {
      // Error toast is the caller's responsibility; keep the modal open to retry/cancel.
    } finally {
      setClosing(false);
    }
  };

  return (
    // h-full (not 100vh) fills the dashboard layout's own scroll container exactly, so
    // ONLY the message thread scrolls — the header + stepper stay pinned. min-h-0 lets
    // the flex children shrink instead of overflowing the page.
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-3 p-3 sm:p-4 md:gap-4 md:p-6">
      {/* Deal header */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          aria-label="Back to Deal Rooms"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <Icon name="arrow_back" size={22} />
        </button>

        {/* Counterparty avatar + name/company — clickable through to their profile preview */}
        <button
          type="button"
          onClick={() => router.push(`/dashboard/profile/${cp.userId}?roleId=${cp.roleId}&companyId=${cp.companyId}`)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left transition-opacity hover:opacity-80 sm:gap-3"
        >
          <div className="relative shrink-0">
            <Avatar photoKey={cp.photoKey} alt={cp.name} className="size-10 rounded-full sm:size-12">
              <div
                className={`flex size-10 items-center justify-center rounded-full bg-gradient-to-br ${ROLE_AVATAR_GRADIENT[cp.role]} font-headline text-base font-bold text-on-primary sm:size-12`}
              >
                {initials(cp.name)}
              </div>
            </Avatar>
            <span
              aria-hidden
              className={`absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface ${
                closed ? "bg-outline-variant" : "bg-[#16a34a]"
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-headline text-base font-extrabold tracking-[-0.01em] text-on-surface sm:text-lg md:text-xl">
              {cp.company || room.title}
            </p>
            {location && (
              <p className="truncate text-xs text-on-surface-variant sm:text-sm">{location}</p>
            )}
          </div>
        </button>

        {/* Action row: Export · Archive · Close Deal (or the Closed badge) */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            aria-label="Export deal room"
            className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container text-sm font-bold text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:w-auto sm:px-4 sm:py-2"
          >
            {exporting ? <Loader size="small" /> : <Icon name="download" size={16} />}
            <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export"}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={archiving}
            aria-label={archived ? "Unarchive deal room" : "Archive deal room"}
            className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container text-sm font-bold text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:w-auto sm:px-4 sm:py-2"
          >
            {archiving ? <Loader size="small" /> : <Icon name={archived ? "unarchive" : "archive"} size={16} />}
            <span className="hidden sm:inline">{archived ? "Unarchive" : "Archive"}</span>
          </button>

          {closed ? (
            <span className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-full bg-surface-container-high text-sm font-semibold text-on-surface-variant sm:h-auto sm:w-auto sm:px-4 sm:py-2">
              <Icon name="lock" size={16} />
              <span className="hidden sm:inline">Closed</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close deal"
              className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-full bg-error text-sm font-bold text-on-error shadow-sm transition-opacity hover:opacity-90 sm:h-auto sm:w-auto sm:px-4 sm:py-2"
            >
              <Icon name="close" size={16} />
              <span className="hidden sm:inline">Close Deal</span>
            </button>
          )}
        </div>
      </div>

      {/* Deal stage pipeline */}
      <div className="shrink-0">
        <DealStageStepper stage={room.stage} />
      </div>

      {/* Body row: chat (left) + side panel (right, desktop only). The chat card is
          UNCHANGED — it's just wrapped so the side panel can sit beside it. */}
      <div className="flex min-h-0 flex-1 gap-4">
      {/* Chat card — flex-1 + min-h-0 so its inner thread is the scroll region. NOTE: no
          `overflow-hidden` here on purpose: the dashboard nests two scroll containers, and
          if this card's height can't fully resolve, clipping would HIDE newly-sent messages
          below the fold. Leaving it unclipped means messages are always visible (the
          dashboard's own scroller is the fallback). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
        {/* Chat status bar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant/30 px-4 py-3">
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-full ${!closed && counterpartyOnline ? "bg-[#16a34a]" : "bg-outline-variant"}`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-on-surface">{cp.name}</p>
            <p className="truncate text-xs text-on-surface-variant">
              {closed ? "Chat closed" : counterpartyOnline ? "Online" : "Offline"}
            </p>
          </div>
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobilePanelOpen(true)}
              aria-label="Show deal details"
              title="Deal details"
              className="inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <Icon name="info" size={22} />
            </button>
          </div>

          {/* Expand / collapse the side panel — a plain arrow toggle (collapsing gives the
              chat full width). Wrapped in `hidden md:block` (a confirmed-generated utility)
              because this Tailwind setup doesn't generate `md:inline-flex`/`md:flex`. */}
          <div className="hidden md:block">
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-label={panelOpen ? "Expand chat (hide side panel)" : "Show side panel"}
              title={panelOpen ? "Expand chat" : "Show side panel"}
              className="inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <Icon name={panelOpen ? "chevron_right" : "chevron_left"} size={22} />
            </button>
          </div>
        </div>

        {/* Message thread with day dividers — the ONLY scroll region on this page. */}
        <div ref={threadRef} className="thin-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4 md:px-6">
          {messages.map((m, i) => {
            const day = dayLabel(m.at);
            const prevDay = i > 0 ? dayLabel(messages[i - 1]!.at) : null;
            return (
              <Fragment key={m.id}>
                {day !== prevDay && (
                  <div className="flex justify-center py-1.5">
                    <span className="rounded-full bg-surface-container-high px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">
                      {day}
                    </span>
                  </div>
                )}
                <MessageBubble message={m} counterparty={cp} onPreview={openPreview} />
              </Fragment>
            );
          })}

          {/* Typing indicator — shown while the counterparty is composing. */}
          {counterpartyTyping && !closed && (
            <div className="flex items-end gap-2.5">
              <Avatar photoKey={cp.photoKey} alt={cp.name} className="size-8 shrink-0 rounded-full">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${ROLE_AVATAR_GRADIENT[cp.role]} text-[11px] font-bold text-on-primary`}
                >
                  {initials(cp.name)}
                </span>
              </Avatar>
              <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-sm bg-surface-container-high px-4 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.1s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-on-surface-variant" />
              </span>
            </div>
          )}

          {/* Scroll anchor — the newest message is kept in view via this element. */}
          <div ref={bottomRef} />
        </div>

        {/* Composer — replaced by a notice once the room is closed */}
        {closed ? (
          <div className="flex shrink-0 items-center justify-center gap-2 border-t border-outline-variant/30 px-3 py-4 text-center text-xs text-on-surface-variant sm:px-4 sm:text-sm">
            <Icon name="lock" size={18} className="shrink-0" />
            This deal room is closed. You can no longer send or receive messages.
          </div>
        ) : (
          <div className="shrink-0 border-t border-outline-variant/30 p-3 md:p-4">
            {/* Pending attachment preview + per-file download permission */}
            {pending && (
              <div className="mb-2 rounded-lg bg-surface-container-high px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon name={pending.kind === "image" ? "image" : "description"} size={20} className="text-on-surface-variant" />
                  <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{pending.name}</span>
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    aria-label="Remove attachment"
                    className="flex size-6 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>

                {/* Segmented toggle: View only (default) vs Allow download. */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">Permission</span>
                  <div className="inline-flex rounded-lg bg-surface-container p-0.5">
                    {([
                      { key: false, label: "View only", icon: "visibility" },
                      { key: true, label: "Allow download", icon: "download" },
                    ] as const).map((opt) => {
                      const active = pending.downloadAllowed === opt.key;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setPending((p) => (p ? { ...p, downloadAllowed: opt.key } : p))}
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                            active
                              ? "bg-primary text-on-primary shadow-sm"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          <Icon name={opt.icon} size={14} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Hidden file input driven by the paperclip inside the field */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickFile(file);
                  e.target.value = ""; // allow re-picking the same file
                }}
              />

              {/* Input field with the attach button nested on the left, before the text */}
              <div className="flex min-w-0 flex-1 items-end gap-1 rounded-xl bg-surface-container pl-1.5 focus-within:ring-2 focus-within:ring-primary">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                  className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                >
                  <Icon name="attach_file" size={20} />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (e.target.value.trim()) onTyping?.();
                    else onStopTyping?.();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Type your message…"
                  className="max-h-32 min-h-12 min-w-0 flex-1 resize-none bg-transparent py-3 pr-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant sm:pr-4"
                />
              </div>
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() && !pending}
                aria-label="Send message"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl cta-gradient text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
              >
                <Icon name="send" size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

        {/* Right-hand side panel — Upcoming Meetings, Shared Files. Shown from md up when
            panelOpen; the status-bar arrow toggles it. Its own scroll so long content
            never pushes the chat around. */}
        {panelOpen && (
          <aside className="thin-scrollbar hidden w-72 shrink-0 overflow-y-auto md:block">
            <DealSidePanel
              room={room}
              closed={closed}
              isLastStage={isLastStage}
              meetingsRefreshKey={meetingsRefreshKey}
              filesRefreshKey={filesRefreshKey}
              onPreview={openPreview}
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
          </aside>
        )}
      </div>
      {/* Below md the same panel opens as a slide-over instead of sitting beside the chat. */}
      <Drawer
        open={mobilePanelOpen}
        onClose={() => setMobilePanelOpen(false)}
        title="Deal Details"
        widthClass="max-w-sm"
        footer={null}
      >
        <DealSidePanel
          room={room}
          closed={closed}
          isLastStage={isLastStage}
          meetingsRefreshKey={meetingsRefreshKey}
          filesRefreshKey={filesRefreshKey}
          onPreview={openPreview}
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
      </Drawer>

      {/* Watermarked preview modal (shared by chat bubbles + the files drawer). */}
      <DocumentPreviewModal
        s3Key={preview?.s3Key ?? null}
        onClose={() => setPreview(null)}
        title={preview?.name ?? "File Preview"}
        fileName={preview?.name}
        mimeType={preview?.mimeType}
        downloadAllowed={preview?.downloadAllowed ?? false}
        // Hide the browser's native PDF Download/Print toolbar so download is gated
        // solely by our own button (shown only when downloadAllowed).
        hidePdfToolbar
      />

      {/* Close Deal confirmation — replaces the native window.confirm(). */}
      <Modal
        open={closeModalOpen}
        onClose={dismissCloseModal}
        title="Close Deal"
        maxWidthClass="max-w-md"
        bodyClassName="p-4 sm:p-6"
        footer={
          <>
            <button
              type="button"
              onClick={dismissCloseModal}
              disabled={closing}
              className="flex h-11 items-center justify-center rounded-xl border border-outline-variant/50 px-6 font-bold max-sm:px-3 max-sm:text-sm text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClose}
              disabled={closing || !closeReason}
              className="flex h-11 min-w-[120px] items-center justify-center rounded-xl bg-error px-6 font-bold max-sm:px-3 max-sm:text-sm text-on-error transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {closing ? <Loader size="small" /> : "Close Deal"}
            </button>
          </>
        }
      >
        <p className="mb-4 text-sm text-on-surface-variant">
          Close the deal with {cp.name}? You won&apos;t be able to send or receive messages.
        </p>
        <Select
          label="Reason"
          required
          value={closeReason}
          onChange={setCloseReason}
          options={CLOSE_DEAL_REASONS}
          placeholder="Select a reason"
        />
      </Modal>
    </div>
  );
}
