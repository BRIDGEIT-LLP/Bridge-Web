"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/modal/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { AsyncState } from "@/components/ui/AsyncState";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { CURRENCIES } from "@/lib/startup-profile-options";
import { formatDateTime } from "@/lib/utils";
import { SharedFilesDrawer } from "./SharedFilesDrawer";
import { ScheduleMeetingDrawer, type ScheduleMeetingFormValues } from "./ScheduleMeetingDrawer";
import { MeetingsDrawer } from "./MeetingsDrawer";
import { MeetingDetailsModal } from "./MeetingDetailsModal";
import { FundingOfferDrawer } from "./FundingOfferDrawer";
import { FundingOffersDrawer } from "./FundingOffersDrawer";
import {
  fetchAllMeetings,
  fetchCurrentFundingOffer,
  fetchCurrentTermSheet,
  fetchDealRoomFiles,
  fetchTermSheetHistory,
  scheduleMeeting,
  type SharedFileItem,
} from "@/services/deal-room.service";
import { getCurrentUserId } from "@/lib/jwt";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ApiError } from "@/lib/axios";
import type {
  B2BTermSheet,
  DealFundingOffer,
  DealRoom,
  FundingOfferFormValues,
  PreviewableFile,
  ScheduledMeeting,
  TermSheetFormValues,
} from "./types";
import {
  DEAL_STAGES,
  DEAL_STAGE_ICONS,
  FUNDING_OFFER_STATUS_META,
  relativeTime,
  stageIndexFromValue,
} from "./deal-room-meta";

/** A file shared in the deal room (top-N preview, scoped to the current stage). */
interface SharedFile {
  id: string;
  name: string;
  size: string;
  by: string;
  icon: string;
  /** Preview payload for opening the watermarked modal. */
  preview: PreviewableFile;
}

/** Small reusable card shell for the side panel. */
function PanelCard({
  icon,
  title,
  action,
  children,
}: {
  icon: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon name={icon} size={18} className="text-primary" />
        <h3 className="flex-1 font-headline text-sm font-bold text-on-surface">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const termSheetDefaults: TermSheetFormValues = {
  moqQuantity: "",
  moqUnit: "",
  unitPrice: "",
  currency: "INR",
  paymentTerms: "",
  supplyLogisticsTerms: "",
};

function valuesFromTermSheet(sheet: B2BTermSheet): TermSheetFormValues {
  return {
    moqQuantity: String(sheet.moqQuantity),
    moqUnit: sheet.moqUnit,
    unitPrice: String(sheet.unitPrice),
    currency: sheet.currency,
    paymentTerms: sheet.paymentTerms,
    supplyLogisticsTerms: sheet.supplyLogisticsTerms,
  };
}

interface TermSheetDrawerProps {
  open: boolean;
  onClose: () => void;
  current: B2BTermSheet | null;
  onConfirm: (values: TermSheetFormValues) => Promise<void> | void;
}

/**
 * Edit form for the collaborative B2B term sheet — reused by either party (no
 * propose/accept step, per the "shared editable form" decision). Local to
 * DealSidePanel rather than its own file: it's one more consumer of the same shared
 * primitives (`Drawer`/`Input`/`Select`/`Textarea`/react-hook-form) FundingOfferDrawer
 * uses, and doesn't warrant a parallel file split for a single-form, single-card feature.
 */
function TermSheetDrawer({ open, onClose, current, onConfirm }: TermSheetDrawerProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TermSheetFormValues>({
    defaultValues: current ? valuesFromTermSheet(current) : termSheetDefaults,
  });

  // Re-populate from the latest snapshot each time the drawer is (re)opened — not on
  // every `current` change while it's open, so an in-progress edit isn't clobbered if
  // the counterparty saves concurrently.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      reset(current ? valuesFromTermSheet(current) : termSheetDefaults);
    }
    wasOpenRef.current = open;
  }, [open, current, reset]);

  const onSubmit = async (values: TermSheetFormValues) => {
    await onConfirm(values);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="B2B Term Sheet"
      subtitle="Either party can edit — saved changes are visible to both"
      widthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl border border-dashed border-outline-variant/60 px-5 font-bold max-sm:px-3 max-sm:text-sm text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="term-sheet-form"
            disabled={isSubmitting}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-6 font-bold max-sm:px-3 max-sm:text-sm text-on-primary transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="save" size={18} />
            {isSubmitting ? "Saving…" : "Share Term Sheet"}
          </button>
        </>
      }
    >
      <form id="term-sheet-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
            Minimum Order Quantity<span className="align-middle text-base leading-none text-error"> *</span>
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="flex flex-col gap-1">
              <span className="px-1 text-[11px] font-semibold text-on-surface-variant">Quantity</span>
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Quantity"
                error={errors.moqQuantity?.message}
                {...register("moqQuantity", {
                  required: "MOQ is required.",
                  validate: (v) => Number(v) > 0 || "Enter a quantity greater than 0.",
                })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="px-1 text-[11px] font-semibold text-on-surface-variant">Unit</span>
              <Input
                placeholder="e.g. Units"
                error={errors.moqUnit?.message}
                {...register("moqUnit", { required: "Unit is required." })}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
            Unit Price<span className="align-middle text-base leading-none text-error"> *</span>
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select aria-label="Currency" options={CURRENCIES} value={field.value} onChange={field.onChange} searchable={false} />
              )}
            />
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Price per unit"
              error={errors.unitPrice?.message}
              {...register("unitPrice", {
                required: "Unit price is required.",
                validate: (v) => Number(v) > 0 || "Enter a price greater than 0.",
              })}
            />
          </div>
        </div>

        <Textarea
          label="Payment Terms"
          required
          rows={3}
          placeholder="e.g. 50% advance, 50% on delivery, Net 30"
          error={errors.paymentTerms?.message}
          {...register("paymentTerms", { required: "Payment terms are required." })}
        />

        <Textarea
          label="Supply / Logistics / Delivery Terms"
          required
          rows={3}
          placeholder="e.g. FOB Mumbai, 4-week lead time"
          error={errors.supplyLogisticsTerms?.message}
          {...register("supplyLogisticsTerms", { required: "Supply/logistics/delivery terms are required." })}
        />
      </form>
    </Drawer>
  );
}

/** Every field's current value for a term-sheet snapshot, alongside whether it changed
 *  from the previous version (`prev` null on the very first version — nothing is
 *  "changed" there, every field is just the starting value). Unlike a pure diff, this
 *  always lists all four fields so a version reads as a complete snapshot, not just
 *  what moved. */
function diffTermSheetFields(prev: B2BTermSheet | null, next: B2BTermSheet): { label: string; value: string; changed: boolean }[] {
  const moqQty = next.moqQuantity.toLocaleString();
  const prevMoqQty = prev ? prev.moqQuantity.toLocaleString() : null;
  const moqQtyChanged = !!prev && prevMoqQty !== moqQty;

  const unit = next.moqUnit;
  const prevUnit = prev ? prev.moqUnit : null;
  const unitChanged = !!prev && prevUnit !== unit;

  const price = `${next.currency} ${next.unitPrice.toLocaleString()}`;
  const prevPrice = prev ? `${prev.currency} ${prev.unitPrice.toLocaleString()}` : null;
  const priceChanged = !!prev && prevPrice !== price;

  const paymentChanged = !!prev && prev.paymentTerms !== next.paymentTerms;
  const supplyChanged = !!prev && prev.supplyLogisticsTerms !== next.supplyLogisticsTerms;

  return [
    { label: "MOQ", value: moqQtyChanged ? `${prevMoqQty} → ${moqQty}` : moqQty, changed: moqQtyChanged },
    { label: "Unit", value: unitChanged ? `${prevUnit} → ${unit}` : unit, changed: unitChanged },
    { label: "Unit Price", value: priceChanged ? `${prevPrice} → ${price}` : price, changed: priceChanged },
    { label: "Payment Terms", value: next.paymentTerms, changed: paymentChanged },
    { label: "Supply/Logistics/Delivery Terms", value: next.supplyLogisticsTerms, changed: supplyChanged },
  ];
}

interface TermSheetHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  dealRoomId: string;
  refreshKey?: number;
}

/**
 * Every saved term sheet version, newest first, each with a diff summary against the
 * previous version ("View All"). Local to DealSidePanel for the same reason as
 * TermSheetDrawer above — reuses `Drawer`/`AsyncState` exactly as `FundingOffersDrawer`
 * does, just without a separate file, since a version row IS its own detail (a diff
 * line), unlike an offer row which opens into a bigger, actionable detail view.
 */
function TermSheetHistoryDrawer({ open, onClose, dealRoomId, refreshKey }: TermSheetHistoryDrawerProps) {
  const [versions, setVersions] = useState<B2BTermSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVersions(await fetchTermSheetHistory(dealRoomId));
    } catch (err) {
      setError((err as ApiError).message ?? "Couldn't load the term sheet history.");
    } finally {
      setLoading(false);
    }
  }, [dealRoomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state lives in load()
    if (open) load();
  }, [open, load, refreshKey]);

  const oldestFirst = [...versions].sort((a, b) => a.version - b.version);
  const newestFirst = [...oldestFirst].reverse();

  return (
    <Drawer open={open} onClose={onClose} title="Term Sheet History" subtitle="Every saved version of the term sheet" footer={null}>
      <AsyncState
        loading={loading}
        error={error}
        isEmpty={versions.length === 0}
        emptyIcon="history"
        emptyText="No term sheet versions yet."
        onRetry={load}
      >
        <ul className="flex flex-col gap-3 p-1">
          {newestFirst.map((v) => {
            const prevIndex = oldestFirst.findIndex((s) => s.id === v.id) - 1;
            const prev = prevIndex >= 0 ? oldestFirst[prevIndex] : null;
            const diffs = diffTermSheetFields(prev, v);
            return (
              <li key={v.id} className="rounded-lg bg-surface-container-low p-3">
                <p className="text-xs font-bold text-on-surface">Version {v.version}</p>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {diffs.map((d) => (
                    <li key={d.label} className={`text-xs ${d.changed ? "text-primary" : "text-on-surface-variant"}`}>
                      <span className={`font-semibold ${d.changed ? "text-primary" : "text-on-surface"}`}>{d.label}:</span> {d.value}
                      {d.changed && <span className="ml-1 text-[10px] font-bold uppercase tracking-wide">· Updated</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-on-surface-variant">
                  {v.version === 1 ? "Sent by" : "Updated by"}{" "}
                  {v.updatedByUserId === getCurrentUserId() ? "You" : v.updatedByName} · {formatDateTime(v.updatedAt)}
                </p>
              </li>
            );
          })}
        </ul>
      </AsyncState>
    </Drawer>
  );
}

interface DealSidePanelProps {
  room: DealRoom;
  /** When the deal is closed the scheduling/actions are disabled. */
  closed: boolean;
  /** True once the room is on the final pipeline stage — nothing further to request. */
  isLastStage: boolean;
  /** Bumped whenever a `meeting_scheduled` socket event lands (own or counterparty's),
   *  so the "Upcoming Meetings" preview refetches live. */
  meetingsRefreshKey?: number;
  /** Bumped whenever a `new_message` socket event carries a file attachment (own or
   *  counterparty's), so the Shared Files preview refetches live (mirrors
   *  meetingsRefreshKey — files are otherwise only refetched on room.stage change). */
  filesRefreshKey?: number;
  /** Open the watermarked preview modal for a shared file. */
  onPreview: (file: PreviewableFile) => void;
  /** Ask the counterparty to move to the next stage (`request_stage_update` socket). */
  onRequestNextStage: () => void;
  /** Accept the counterparty's pending stage-update request. */
  onAcceptStage: () => void;
  /** Reject the counterparty's pending stage-update request. */
  onRejectStage: () => void;
  /** Bumped whenever a funding_offer_created/_responded socket event lands, so the
   *  card's inline preview + any open detail modal refetch live (mirrors meetingsRefreshKey). */
  fundingOfferRefreshKey?: number;
  /** Send a brand-new funding offer (investor only). */
  onSendFundingOffer: (values: FundingOfferFormValues) => void | Promise<void>;
  /** Accept the given pending funding offer (recipient only). */
  onAcceptFundingOffer: (offerId: string) => void;
  /** Reject the given pending funding offer (recipient only). */
  onRejectFundingOffer: (offerId: string) => void;
  /** Submit a counter against the given funding offer (recipient only). */
  onCounterFundingOffer: (offerId: string, values: FundingOfferFormValues) => void | Promise<void>;
  /** Bumped whenever a term_sheet_updated socket event lands, so the card + any open
   *  history drawer refetch live (mirrors fundingOfferRefreshKey). */
  termSheetRefreshKey?: number;
  /** Save an edit to the B2B term sheet (either party). */
  onSaveTermSheet: (values: TermSheetFormValues) => void | Promise<void>;
}

/**
 * The deal room's RIGHT-hand panel: Upcoming Meetings (with Schedule Meeting),
 * Shared Files (top-N inline + a "View All" drawer backed by the files API), and
 * Active Participants.
 */
export function DealSidePanel({
  room,
  closed,
  isLastStage,
  meetingsRefreshKey,
  filesRefreshKey,
  onPreview,
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
}: DealSidePanelProps) {
  const { counterparty: cp } = room;
  const { role } = useAuth();
  // Funding Offer is a startup/investor-only concept; B2B Term Sheet is B2B-only — each
  // role only ever calls its own current-state endpoint, never the other's.
  const isB2BRoom = role === "b2b_enterprise" && cp.role === "b2b_enterprise";
  const canCallFundingOfferApi = role === "startup" || role === "investor";
  // Live stage name + icon — updates whenever room.stage changes (stage-update socket flow).
  const stageLabel = DEAL_STAGES[room.stage] ?? DEAL_STAGES[0];
  const stageIcon = DEAL_STAGE_ICONS[room.stage] ?? DEAL_STAGE_ICONS[0];
  const pendingStageRequest = room.pendingStageRequest;
  // Is the pending request mine (waiting on them) or theirs (I can accept/reject)?
  const iRequestedStage = pendingStageRequest != null && pendingStageRequest.requestedByUserId === getCurrentUserId();

  /** Every meeting in this room (GET /meetings). Shared with MeetingsDrawer; the inline
   *  card derives its "upcoming" subset from it. */
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [meetingsOpen, setMeetingsOpen] = useState(false);
  /** The meeting whose details modal is open; null = closed. Passed as a whole row (it
   *  came from the list we already have) so the modal needn't refetch it by id. */
  const [selectedMeeting, setSelectedMeeting] = useState<ScheduledMeeting | null>(null);
  /** Confirmation modal for "Request Next Stage" — asks before firing the socket event. */
  const [confirmStageOpen, setConfirmStageOpen] = useState(false);
  /** Auto-opened for the RECIPIENT the moment a stage request arrives LIVE — reuses the
   *  same modal element as the requester's confirm prompt (polymorphic by mode below). */
  const [respondStageOpen, setRespondStageOpen] = useState(false);
  /** Which pending-request id we've already auto-popped the modal for, so dismissing it
   *  (or a re-render) doesn't reopen the same request. */
  const autoShownRequestIdRef = useRef<string | null>(null);
  /** Whether we've processed the first render's state. A request already pending on mount
   *  came from the initial REST fetch (fetchPendingStageRequest), NOT a live socket
   *  arrival — so we suppress its auto-popup, otherwise a days-old request would
   *  re-interrupt the recipient on every page open/reload. Only requests that appear
   *  AFTER mount (live via `stage_update_requested`) pop the modal. */
  const stageInitializedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drives the auto-open modal
    if (!pendingStageRequest) {
      autoShownRequestIdRef.current = null;
      setRespondStageOpen(false);
      stageInitializedRef.current = true;
      return;
    }
    if (!stageInitializedRef.current) {
      // Already pending when the page loaded — mark it seen without popping the modal
      // (the in-card Accept/Reject buttons still show it).
      stageInitializedRef.current = true;
      autoShownRequestIdRef.current = pendingStageRequest.id;
      return;
    }
    if (!iRequestedStage && !closed && autoShownRequestIdRef.current !== pendingStageRequest.id) {
      autoShownRequestIdRef.current = pendingStageRequest.id;
      setRespondStageOpen(true);
    }
  }, [pendingStageRequest, iRequestedStage, closed]);

  // One shared stage modal, two modes: "respond" (recipient acts on an incoming request)
  // takes priority over "confirm" (I'm about to send my own request).
  const stageModalMode = respondStageOpen ? "respond" : confirmStageOpen ? "confirm" : null;
  const requestedStageLabel = DEAL_STAGES[stageIndexFromValue(pendingStageRequest?.requestedStage)] ?? "the next stage";

  /**
   * ONE fetch of every meeting in this room, owned here. `GET /meetings` is a superset
   * of `GET /meetings/upcoming`, so the inline preview below derives "upcoming" from it
   * with the same predicate MeetingsDrawer uses — and the drawer now reads this list as
   * a prop instead of issuing its own identical request when it opens.
   */
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  /** Wall clock captured when the list last arrived. Splitting upcoming from past needs
   *  a "now", and reading the clock during render is impure — this pins it to the fetch. */
  const [meetingsLoadedAt, setMeetingsLoadedAt] = useState(0);

  const loadMeetings = useCallback(() => {
    setMeetingsLoading(true);
    setMeetingsError(null);
    fetchAllMeetings(room.id)
      .then((rows) => {
        setMeetings(rows);
        setMeetingsLoadedAt(Date.now());
      })
      .catch((err) => {
        setMeetingsError((err as ApiError).message ?? "Couldn't load meetings.");
      })
      .finally(() => setMeetingsLoading(false));
  }, [room.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state lives in loadMeetings()
    loadMeetings();
    // meetingsRefreshKey deliberately included: a `meeting_scheduled` socket event (mine
    // or the counterparty's) bumps it so this refetches live, without polling.
  }, [loadMeetings, meetingsRefreshKey]);

  /** Add or replace one meeting in place — used after a create/edit, whose response
   *  already carries the full normalized row, so there's nothing to refetch. */
  const upsertMeeting = useCallback((meeting: ScheduledMeeting) => {
    setMeetings((prev) => {
      const i = prev.findIndex((m) => m.id === meeting.id);
      if (i === -1) return [...prev, meeting];
      const next = [...prev];
      next[i] = meeting;
      return next;
    });
  }, []);

  /** Future meetings, soonest first — the same rule MeetingsDrawer applies. */
  const upcomingMeetings = useMemo(
    () =>
      meetings
        .filter((m) => new Date(m.scheduledAt).getTime() >= meetingsLoadedAt)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [meetings, meetingsLoadedAt],
  );

  /**
   * ONE fetch of every file in this room, owned here. The inline preview is scoped to
   * the CURRENT stage (each row carries the stage it was shared under), while the
   * "View All" drawer needs the whole list — so we keep the unfiltered list and derive
   * both, rather than the drawer refetching the identical payload on open. Filtering by
   * stage is also why `room.stage` is NOT a fetch dependency: a stage change re-derives
   * from what we already have.
   */
  const [allFiles, setAllFiles] = useState<SharedFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);

  const loadFiles = useCallback(() => {
    setFilesLoading(true);
    setFilesError(null);
    fetchDealRoomFiles(room.id)
      .then(setAllFiles)
      .catch((err) => {
        setAllFiles([]);
        setFilesError((err as ApiError).message ?? "Couldn't load the shared files.");
      })
      .finally(() => setFilesLoading(false));
  }, [room.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state lives in loadFiles()
    loadFiles();
    // filesRefreshKey deliberately included: a `new_message` socket event carrying a
    // file attachment (mine or the counterparty's) bumps it so this refetches live,
    // without polling — mirrors the meetingsRefreshKey pattern above.
  }, [loadFiles, filesRefreshKey]);

  const stageFiles = useMemo(
    () => allFiles.filter((f) => stageIndexFromValue(f.stage) === room.stage),
    [allFiles, room.stage],
  );

  const files = useMemo<SharedFile[]>(
    () =>
      stageFiles.map((f) => ({
        id: f.messageId,
        name: f.name,
        size: `${(f.size / 1024).toFixed(0)} KB`,
        by: f.by,
        icon: f.kind === "image" ? "image" : "description",
        preview: { name: f.name, s3Key: f.s3Key, mimeType: f.mimeType, downloadAllowed: f.downloadAllowed },
      })),
    [stageFiles],
  );

  const handleScheduleMeeting = async (values: ScheduleMeetingFormValues) => {
    try {
      await scheduleMeeting({
        dealRoomId: room.id,
        recipientUserId: cp.userId,
        title: values.title,
        agenda: values.agenda,
        meetingLink: values.link,
        scheduledAt: new Date(`${values.date}T${values.time}`).toISOString(),
        duration: values.duration,
      });
      loadMeetings();
      setScheduleOpen(false);
      toast.success("Meeting scheduled.");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't schedule the meeting. Please try again.");
    }
  };

  // Funding Offer card — visible only to startup/investor roles. Loaded from the
  // (placeholder) files API and refetched whenever a funding_offer_* socket event
  // bumps fundingOfferRefreshKey, mirroring the Upcoming Meetings pattern above.
  const [currentOffer, setCurrentOffer] = useState<DealFundingOffer | null>(null);
  const [offerDrawerOpen, setOfferDrawerOpen] = useState(false);
  const [offerDrawerMode, setOfferDrawerMode] = useState<"create" | "counter">("create");
  const [offersListOpen, setOffersListOpen] = useState(false);
  /** Which entry point opened the drawer: the preview card ("current" only) vs the
   *  "View All" button (full negotiation history too). */
  const [offersDrawerView, setOffersDrawerView] = useState<"current" | "all">("current");
  /** Snapshot of the offer being countered — set from the offers drawer's Counter
   *  button so FundingOfferDrawer (the create/counter form) has it to prefill. */
  const [offerToCounter, setOfferToCounter] = useState<DealFundingOffer | null>(null);

  const loadCurrentOffer = useCallback(() => {
    if (!canCallFundingOfferApi) return;
    fetchCurrentFundingOffer(room.id)
      .then(setCurrentOffer)
      .catch(() => setCurrentOffer(null));
  }, [room.id, canCallFundingOfferApi]);

  useEffect(() => {
    loadCurrentOffer();
  }, [loadCurrentOffer, fundingOfferRefreshKey]);

  // Funding offers are a Negotiation-stage activity: the card shows from Negotiation on
  // (view-only afterwards), but offers can only be created/actioned WHILE in Negotiation —
  // once the deal moves to Due Diligence they're locked (server-enforced too). Mirrors the
  // B2B term-sheet gating above.
  const canShowFundingOffer = (role === "startup" || role === "investor") && room.stage >= 1;
  const canEditFundingOffer = canShowFundingOffer && room.stage === 1;
  const offerPending = !!currentOffer && currentOffer.status === "Pending";

  // B2B Term Sheet card — visible only to b2b_enterprise. Same load/refresh-key
  // pattern as Funding Offer above.
  const [termSheet, setTermSheet] = useState<B2BTermSheet | null>(null);
  const [termSheetDrawerOpen, setTermSheetDrawerOpen] = useState(false);
  const [termSheetHistoryOpen, setTermSheetHistoryOpen] = useState(false);

  const loadTermSheet = useCallback(() => {
    if (!isB2BRoom) return;
    fetchCurrentTermSheet(room.id)
      .then(setTermSheet)
      .catch(() => setTermSheet(null));
  }, [room.id, isB2BRoom]);

  useEffect(() => {
    loadTermSheet();
  }, [loadTermSheet, termSheetRefreshKey]);

  // The term sheet appears once negotiation starts and stays visible (read-only) for
  // the rest of the deal's life, but can only be EDITED while still on Negotiation —
  // once Due Diligence begins, the terms are locked for both parties (server-enforced too).
  const canShowTermSheet = isB2BRoom && room.stage >= 1;
  const canEditTermSheet = isB2BRoom && room.stage === 1;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* ---- Upcoming Meetings ---- */}
        <PanelCard
          icon="event"
          title="Upcoming Meetings"
          action={
            <button
              type="button"
              onClick={() => setMeetingsOpen(true)}
              className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant transition-colors hover:bg-secondary-container/70"
            >
              View All
            </button>
          }
        >
          {upcomingMeetings.length === 0 ? (
            <p className="py-2 text-xs text-on-surface-variant">No meetings scheduled yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {upcomingMeetings.slice(0, 2).map((mtg) => (
                <li key={mtg.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedMeeting(mtg)}
                    className="w-full rounded-xl bg-surface-container-low p-3 text-left transition-colors hover:bg-surface-container"
                  >
                    <p className="text-sm font-bold text-on-surface">{mtg.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-primary">
                      <Icon name="schedule" size={13} />
                      {mtg.when}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={closed}
            onClick={() => setScheduleOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant/50 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            <Icon name="add" size={16} />
            Schedule Meeting
          </button>
        </PanelCard>

        {/* ---- Shared Files ---- */}
        <PanelCard
          icon={stageIcon}
          title={stageLabel}
          action={
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                {files.length}
              </span>
              <button
                type="button"
                onClick={() => setFilesOpen(true)}
                className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant transition-colors hover:bg-secondary-container/70"
              >
                View All
              </button>
            </div>
          }
        >
          {files.length === 0 ? (
            <p className="py-2 text-xs text-on-surface-variant">No files shared yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {files.slice(0, 2).map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onPreview(f.preview)}
                    className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-surface-container-low"
                  >
                    <Icon name={f.icon} size={22} className="shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-on-surface">{f.name}</span>
                      <span className="block truncate text-[11px] text-on-surface-variant">
                        {f.size} · {f.by}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pendingStageRequest && !iRequestedStage ? (
            // Their request is pending — I can accept or reject it.
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onRejectStage}
                disabled={closed}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/50 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:border-error/50 hover:text-error disabled:opacity-50"
              >
                <Icon name="close" size={16} />
                Reject
              </button>
              <button
                type="button"
                onClick={onAcceptStage}
                disabled={closed}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg cta-gradient py-2 text-xs font-bold text-on-primary disabled:opacity-50"
              >
                <Icon name="check" size={16} />
                Accept
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmStageOpen(true)}
              disabled={closed || isLastStage || iRequestedStage}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant/50 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              {iRequestedStage ? "Request Pending…" : "Request Next Stage"}
              <Icon name="arrow_forward" size={16} />
            </button>
          )}
        </PanelCard>

        {/* ---- Funding Offer (Stage 2: Negotiation) — startup/investor only ---- */}
        {canShowFundingOffer && (
          <PanelCard
            icon="handshake"
            title="Funding Offer"
            action={
              <button
                type="button"
                onClick={() => {
                  setOffersDrawerView("all");
                  setOffersListOpen(true);
                }}
                className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant transition-colors hover:bg-secondary-container/70"
              >
                View All
              </button>
            }
          >
            {!currentOffer ? (
              <p className="py-2 text-xs text-on-surface-variant">No funding offer yet.</p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOffersDrawerView("current");
                  setOffersListOpen(true);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left transition-colors hover:bg-surface-container-low"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-on-surface">
                    {currentOffer.currency} {currentOffer.amount.toLocaleString()} · {currentOffer.equityPercent}%
                  </span>
                </span>
                <StatusPill {...FUNDING_OFFER_STATUS_META[currentOffer.status]} />
              </button>
            )}

            {canEditFundingOffer ? (
              <div className="group relative">
                <button
                  type="button"
                  disabled={closed || role === "startup" || offerPending}
                  onClick={() => {
                    setOfferDrawerMode("create");
                    setOfferDrawerOpen(true);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant/50 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                >
                  <Icon name="request_quote" size={16} />
                  Request Offer
                </button>
                {role === "startup" && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[220px] -translate-x-1/2 scale-95 rounded-lg bg-surface-container-highest px-3 py-2 text-center text-xs font-medium text-on-surface opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
                  >
                    Only investors can send a funding offer.
                  </span>
                )}
              </div>
            ) : (
              // Past Negotiation the offer is frozen for both parties — explain why the
              // action is gone instead of silently omitting it (server-enforced too).
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                <Icon name="lock" size={14} className="shrink-0" />
                Locked — offers are only made during Negotiation.
              </p>
            )}
          </PanelCard>
        )}

        {/* ---- B2B Term Sheet (Stage 2: Negotiation) — b2b_enterprise only ---- */}
        {canShowTermSheet && (
          <PanelCard
            icon="description"
            title="B2B Term Sheet"
            action={
              <button
                type="button"
                onClick={() => setTermSheetHistoryOpen(true)}
                className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant transition-colors hover:bg-secondary-container/70"
              >
                View All
              </button>
            }
          >
            {!termSheet ? (
              <p className="py-2 text-xs text-on-surface-variant">No term sheet yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container-low p-2.5 text-xs">
                <p className="text-on-surface">
                  <span className="font-semibold">MOQ:</span> {termSheet.moqQuantity.toLocaleString()}
                </p>
                <p className="text-on-surface">
                  <span className="font-semibold">Unit:</span> {termSheet.moqUnit}
                </p>
                <p className="text-on-surface">
                  <span className="font-semibold">Unit Price:</span> {termSheet.currency} {termSheet.unitPrice.toLocaleString()}
                </p>
                <p className="truncate text-on-surface">
                  <span className="font-semibold">Payment:</span> {termSheet.paymentTerms}
                </p>
                <p className="truncate text-on-surface">
                  <span className="font-semibold">Supply/Logistics:</span> {termSheet.supplyLogisticsTerms}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Version {termSheet.version} · updated by{" "}
                  {termSheet.updatedByUserId === getCurrentUserId() ? "You" : termSheet.updatedByName} ·{" "}
                  {relativeTime(termSheet.updatedAt)}
                </p>
              </div>
            )}

            {canEditTermSheet ? (
              <button
                type="button"
                disabled={closed}
                onClick={() => setTermSheetDrawerOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant/50 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
              >
                <Icon name={termSheet ? "edit" : "add"} size={16} />
                {termSheet ? "Edit Term Sheet" : "Send Term Sheet"}
              </button>
            ) : (
              // Past Negotiation the terms are locked for both parties — explain why
              // the edit action is gone instead of silently omitting it.
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                <Icon name="lock" size={14} className="shrink-0" />
                Locked — editable only during Negotiation.
              </p>
            )}
          </PanelCard>
        )}
      </div>

      {/* One reused modal: the requester's "confirm before requesting" prompt AND the
          recipient's real-time Accept/Reject on an incoming request (mode-switched). */}
      <Modal
        open={stageModalMode !== null}
        onClose={() => {
          // ✕ / backdrop / Escape just dismiss — in "respond" mode the in-card
          // Accept/Reject buttons remain as the fallback.
          setConfirmStageOpen(false);
          setRespondStageOpen(false);
        }}
        title={stageModalMode === "respond" ? "Stage Change Request" : "Move to Next Stage?"}
        maxWidthClass="max-w-sm"
        footer={
          stageModalMode === "respond" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onRejectStage();
                  setRespondStageOpen(false);
                }}
                disabled={closed}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-outline-variant/50 font-bold text-on-surface-variant transition-colors hover:border-error/50 hover:text-error disabled:opacity-50"
              >
                <Icon name="close" size={16} />
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  onAcceptStage();
                  setRespondStageOpen(false);
                }}
                disabled={closed}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl cta-gradient font-bold text-on-primary disabled:opacity-50"
              >
                <Icon name="check" size={16} />
                Accept
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmStageOpen(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-outline-variant/50 font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  onRequestNextStage();
                  setConfirmStageOpen(false);
                }}
                className="flex h-11 flex-1 items-center justify-center rounded-xl cta-gradient font-bold text-on-primary"
              >
                Yes
              </button>
            </>
          )
        }
      >
        {stageModalMode === "respond" ? (
          <p className="text-sm text-on-surface-variant">
            {cp.name} wants to move this deal to{" "}
            <span className="font-semibold text-on-surface">{requestedStageLabel}</span>. Do you accept?
          </p>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Do you want to request {cp.name} to move this deal to the next stage?
          </p>
        )}
      </Modal>

      {/* All shared files — rendered from the list this panel already fetched */}
      <SharedFilesDrawer
        open={filesOpen}
        onClose={() => setFilesOpen(false)}
        files={allFiles}
        loading={filesLoading}
        error={filesError}
        onRetry={loadFiles}
        currentStage={room.stage}
        onPreview={onPreview}
      />

      {/* Schedule Meeting drawer (right slide-in) */}
      <ScheduleMeetingDrawer open={scheduleOpen} onClose={() => setScheduleOpen(false)} onConfirm={handleScheduleMeeting} />

      {/* All meetings (mirrors Shared Files' "View All") — same shared list */}
      <MeetingsDrawer
        open={meetingsOpen}
        onClose={() => setMeetingsOpen(false)}
        meetings={meetings}
        now={meetingsLoadedAt}
        loading={meetingsLoading}
        error={meetingsError}
        onRetry={loadMeetings}
        onSelect={setSelectedMeeting}
        onScheduleNew={() => {
          setMeetingsOpen(false);
          setScheduleOpen(true);
        }}
        closed={closed}
      />

      {/* Meeting details, opened from either the inline list or MeetingsDrawer. The whole
          row is handed over, so no GET /meetings/detail round-trip for data we have. */}
      <MeetingDetailsModal
        meeting={selectedMeeting}
        closed={closed}
        onClose={() => setSelectedMeeting(null)}
        onUpdated={(updated) => {
          const row = { ...updated, id: selectedMeeting?.id ?? updated.id };
          upsertMeeting(row);
          setSelectedMeeting(row);
        }}
      />

      {/* Create a new offer (investor) or submit a counter (founder, opened from the offers drawer) */}
      <FundingOfferDrawer
        open={offerDrawerOpen}
        onClose={() => setOfferDrawerOpen(false)}
        mode={offerDrawerMode}
        counterpartyName={cp.name}
        sourceOffer={offerDrawerMode === "counter" ? offerToCounter : null}
        onConfirm={async (values) => {
          if (offerDrawerMode === "counter" && offerToCounter) {
            await onCounterFundingOffer(offerToCounter.id, values);
          } else {
            await onSendFundingOffer(values);
          }
          setOfferDrawerOpen(false);
        }}
      />

      {/* The current actionable offer (Accept/Reject/Counter, role-gated to the offer's
          recipient) — plus the full negotiation history below it, only when opened via
          "View All" (offersDrawerView). */}
      <FundingOffersDrawer
        open={offersListOpen}
        onClose={() => setOffersListOpen(false)}
        dealRoomId={room.id}
        current={currentOffer}
        refreshKey={fundingOfferRefreshKey}
        closed={closed}
        locked={!canEditFundingOffer}
        view={offersDrawerView}
        onAccept={(offerId) => onAcceptFundingOffer(offerId)}
        onReject={(offerId) => onRejectFundingOffer(offerId)}
        onCounter={(offer) => {
          setOfferToCounter(offer);
          setOfferDrawerMode("counter");
          setOfferDrawerOpen(true);
          setOffersListOpen(false);
        }}
      />

      {/* Edit the B2B term sheet — either party may open this */}
      <TermSheetDrawer
        open={termSheetDrawerOpen}
        onClose={() => setTermSheetDrawerOpen(false)}
        current={termSheet}
        onConfirm={async (values) => {
          await onSaveTermSheet(values);
          setTermSheetDrawerOpen(false);
        }}
      />

      {/* Every saved term sheet version, with field-level diffs ("View All") */}
      <TermSheetHistoryDrawer
        open={termSheetHistoryOpen}
        onClose={() => setTermSheetHistoryOpen(false)}
        dealRoomId={room.id}
        refreshKey={termSheetRefreshKey}
      />
    </>
  );
}
