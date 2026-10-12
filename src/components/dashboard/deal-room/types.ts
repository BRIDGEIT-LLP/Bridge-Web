/**
 * DEMO-ONLY types for the Deal Room walkthrough. Kept LOCAL to the deal-room feature
 * (deliberately not added to the shared `types/api.types.ts`) so the entire demo is
 * self-contained: deleting the `deal-room/` route + component folders removes the
 * feature without touching any committed/shared code.
 *
 * When this is built for real, promote these to `types/api.types.ts` and back them
 * with the socket/API contract (see the TODO(real) note in DealRoomChat.tsx).
 */

import type { Role } from "@/lib/roles";

/** Room lifecycle. ACTIVE + PAUSED both show under the "Active Deals" tab. */
export type DealRoomStatus = "ACTIVE" | "PAUSED" | "CLOSED";

/** The list buckets the Active / Closed / Archived toggle switches between. The ARCHIVED
 *  bucket is a UI placeholder for now — it stays empty until a backend archive API exists
 *  (no room can actually be archived yet). */
export type DealRoomTab = "ACTIVE" | "CLOSED" | "ARCHIVED";

/** The other party in a deal room (derived from the accepted connection). */
export interface DealCounterparty {
  /** UUID — sent as `recipientUserId` when scheduling a meeting. */
  userId: string;
  /** Numeric role id — needed (with companyId) to open the counterparty's profile
   *  preview page (GET /users/role-details). */
  roleId: number;
  /** UUID — see roleId. */
  companyId: string;
  name: string;
  /** Job title, e.g. "Managing Partner". */
  title: string;
  company: string;
  /** No `state`/province column exists in Bridge-Server's schema today (only per-user
   *  `country`) — always blank until the backend adds one; formatLocation() skips it. */
  state?: string;
  country?: string;
  role: Role;
  /** Stored profile-picture key (`user.profile_photo`); undefined = show initials. */
  photoKey?: string | null;
}

/** A file attached to a message. */
export interface DealAttachment {
  /** Id of the message this attachment belongs to (used as a stable key / lookup). */
  messageId: string;
  name: string;
  /** Size in bytes. */
  size: number;
  /** "image" renders an inline preview; everything else shows a file chip. */
  kind: "image" | "file";
  /** S3 key — passed to the watermarked `/file/file-preview` endpoint for preview/download. */
  s3Key?: string;
  /** MIME type, e.g. "application/pdf" (used to pick the preview renderer). */
  mimeType?: string;
  /** Whether the recipient is allowed to download this file (else view-only). */
  downloadAllowed: boolean;
  /** Local object URL while pending upload (composer only); "" for server messages. */
  url: string;
}

/** The minimal shape needed to open the watermarked preview modal for a shared file.
 *  Satisfied by both `DealAttachment` and the shared-files list rows. */
export interface PreviewableFile {
  name: string;
  s3Key?: string;
  mimeType?: string;
  downloadAllowed: boolean;
}

/** A single chat message inside a room. `sender` is relative to the current user. */
export interface DealMessage {
  /** Unique across text + media (tables have independent auto-increment ids). */
  id: string;
  /** "me" = current user, "them" = the counterparty. */
  sender: "me" | "them";
  /** Display name of the author (for the counterparty side). */
  authorName: string;
  /** Optional — a message can be just an attachment. */
  text?: string;
  /** Optional attached file. */
  attachment?: DealAttachment;
  /** ISO timestamp. */
  at: string;
  /** For MY ("me") messages only: has the counterparty read it? Drives the delivered
   *  (single tick) vs seen (double blue tick) receipt. Undefined/false = delivered. */
  read?: boolean;
}

/** A meeting scheduled inside a deal room (`POST /meetings`, normalized for display). */
export interface ScheduledMeeting {
  id: string;
  /** True if the logged-in user is the one who scheduled this meeting — only they're allowed to edit it (enforced server-side too). */
  createdByMe: boolean;
  title: string;
  /** Friendly when-label, e.g. "Oct 24, 10:30 AM". */
  when: string;
  /** ISO timestamp of the scheduled time. */
  scheduledAt: string;
  /** Friendly created-at label, e.g. "Jul 10, 9:36 AM". */
  createdAtLabel: string;
  /** ISO timestamp of when the meeting was created. */
  createdAt: string;
  /** First + last name of the deal-room participant who requested the meeting. */
  requesterName: string;
  duration: string;
  link: string;
  agenda: string;
}

/** A pending "move to the next stage" request awaiting the counterparty's decision
 *  (`request_stage_update` / `respond_stage_update` sockets). Null/undefined = no
 *  outstanding request for this room. */
export interface DealStageRequest {
  id: string;
  /** Backend stage enum value being requested, e.g. "Negotiation" (see DEAL_STAGE_VALUES). */
  requestedStage: string;
  /** Who asked — compare against the logged-in user id to tell "I requested" from
   *  "they requested, I can accept/reject". */
  requestedByUserId: string;
}

export type FundingOfferStatus = "Draft" | "Pending" | "Accepted" | "Rejected" | "Countered";
export type ValuationType = "Pre-money" | "Post-money";

/** A structured funding offer exchanged during Stage 2: Negotiation
 *  (`create_funding_offer` / `respond_funding_offer` sockets). Countering creates a NEW
 *  row linked via `parentOfferId`, forming a negotiation chain; `version` is the
 *  1-based position in that chain. */
export interface DealFundingOffer {
  id: string;
  status: FundingOfferStatus;
  /** Who sent THIS version — compare to getCurrentUserId() for "mine vs theirs". */
  createdByUserId: string;
  /** First + last name of whoever sent this version. */
  offeredByName: string;
  /** Who this version is addressed to (flips on each counter). */
  recipientUserId: string;
  /** First + last name of the recipient of this version. */
  recipientName: string;
  amount: number;
  currency: string;
  /** (0, 100) exclusive. */
  equityPercent: number;
  valuationType: ValuationType;
  /** ISO date — must be a future date at creation time. */
  validUntil: string;
  terms?: string;
  notes?: string;
  /** Previous offer's id, if this is a counter; null/undefined on the first offer. */
  parentOfferId?: string | null;
  /** True for every version except the original root offer. */
  isCounterOffer: boolean;
  /** Id of the root (version 1) offer of this negotiation thread. */
  rootOfferId?: string | null;
  version: number;
  createdAt: string;
  /** ISO timestamp this version was sent to the recipient. */
  sentAt?: string;
  /** Who accepted/rejected/countered this version, if it's been actioned yet. */
  respondedByUserId?: string;
  respondedByName?: string;
  /** ISO timestamp this version was actioned; null/undefined while still Pending. */
  respondedAt?: string | null;
}

/** Create/counter funding-offer form values (FundingOfferDrawer). */
export interface FundingOfferFormValues {
  amount: string;
  currency: string;
  equityPercent: string;
  valuationType: ValuationType | "";
  /** yyyy-mm-dd. */
  validUntil: string;
  terms: string;
  notes: string;
}

/** A saved snapshot of the collaboratively-edited B2B term sheet. Whole-snapshot
 *  versioning: every save creates a new row with ALL fields' values at that point —
 *  the history view diffs consecutive versions to show what changed. */
export interface B2BTermSheet {
  id: string;
  version: number;
  moqQuantity: number;
  moqUnit: string;
  unitPrice: number;
  currency: string;
  paymentTerms: string;
  supplyLogisticsTerms: string;
  updatedByUserId: string;
  /** First + last name of whoever saved this version. */
  updatedByName: string;
  updatedAt: string;
}

/** Term sheet edit form values (TermSheetDrawer, local to DealSidePanel.tsx). */
export interface TermSheetFormValues {
  moqQuantity: string;
  moqUnit: string;
  unitPrice: string;
  currency: string;
  paymentTerms: string;
  supplyLogisticsTerms: string;
}

/** One deal room = an accepted connection the two parties are progressing. */
export interface DealRoom {
  id: string;
  /** Deal headline shown in the list + chat header, e.g. "Series B Funding — Horizon FinTech". */
  title: string;
  counterparty: DealCounterparty;
  status: DealRoomStatus;
  /** Whether the CURRENT user has archived this room (per-user view — derived from the
   *  backend's `archived_at` on the list row). Archived rooms live under the Archived tab. */
  isArchived: boolean;
  /** 0-based index into DEAL_STAGES of the stage the deal is currently in. */
  stage: number;
  /** The room's currently pending stage-update request, if any. */
  pendingStageRequest?: DealStageRequest | null;
  /** Short summary of the latest event, e.g. "Term sheet revised by Legal". */
  lastActivityNote: string;
  /** Count of unread messages for the current user. */
  unread: number;
  /** ISO timestamp of the most recent activity. */
  lastActivityAt: string;
  messages: DealMessage[];
}