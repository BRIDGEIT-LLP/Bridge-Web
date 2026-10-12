/** Payload sent when registering a company (step 1). Field names/values match the backend schema. */
export interface RegisterPayload {
  companyName: string;
  email: string;
  // countryCode currently not sent — kept optional so it can be re-enabled later.
  countryCode?: string;
  phoneNumber: string;
  password: string;
  role: "INVESTOR" | "B2B" | "STARTUP";
  termsAccepted: boolean;
  gstNumber?: string;
  cinNumber?: string;
}

export interface RegisterResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/** Payload sent to check a GSTIN (registration form, on field blur). */
export interface VerifyGstPayload {
  gstin: string;
}

export interface VerifyGstResponse {
  success?: boolean;
  message?: string;
  data?: {
    verified: boolean;
    legalName?: string | null;
    tradeName?: string | null;
    status?: string | null;
    pan?: string | null;
    businessNature?: string | null;
    stateName?: string | null;
    stateCode?: string | null;
    registrationDate?: string | null;
    /** Raw response body from sandbox.co.in's gstin/verify call. */
    verificationDetails?: unknown;
  };
}

/** Payload sent to check a CIN (registration form, on field blur). Mirrors VerifyGstPayload. */
export interface VerifyCinPayload {
  cin: string;
}

export interface VerifyCinResponse {
  success?: boolean;
  message?: string;
  data?: {
    verified: boolean;
    companyName?: string | null;
    companyStatus?: string | null;
    dateOfIncorporation?: string | null;
    registeredAddress?: string | null;
    rocCode?: string | null;
    /** Raw response body from sandbox.co.in's mca/company/master-data/search call. */
    verificationDetails?: unknown;
  };
}

import type { Role } from "@/lib/roles";

/** Payload sent when logging in. Field names/values match the backend schema. */
export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Response from the login endpoint. The pre-MFA token is set as an httpOnly cookie
 * directly on this response — nothing token-shaped is in the body. `redirectTo` is
 * the route the backend wants the client to land on (e.g. the next pending
 * onboarding step or the home dashboard).
 */
export interface LoginResponse {
  success?: boolean;
  message?: string;
  data?: {
    redirectTo?: string;
    /** Raw role string from the backend (e.g. "INVESTOR"); normalize via normalizeRole. */
    role?: string;
    /** Authenticated user's name, when the backend echoes it on login. */
    first_name?: string | null;
    last_name?: string | null;
    /** Already-masked contact info for display on the verification-channel screen. */
    maskedMobile?: string;
    maskedEmail?: string;
  };
}

/** Payload for switching the active user role (re-issues a token for that role). */
export interface SwitchRolePayload {
  role: Role;
}

/**
 * One registration field for the target role, as described by
 * `user_profile_field_master` (see authService.listSwitchRoleFields).
 * `fieldName` is the DB column — the frontend's `ProfileField.columnName`.
 */
export interface SwitchRoleFieldMeta {
  fieldName: string;
  label: string;
  /**
   * Which table the column lives on. `user` columns are writable via the
   * request-role-switch body. Empty company GST/CIN are also first-fill
   * writable there; other company columns stay locked.
   */
  sourceTable?: string;
  /** "string" | "number" | "url" | "email" | "textarea" | "array" | … */
  type: string;
  isEditable?: boolean;
  isRequired?: boolean;
  /** True when the user/company row already has a value for this column. */
  isFilled?: boolean;
  value?: unknown;
}

/** Response from `GET /auth/switch-role-details`. */
export interface SwitchRoleDetailsResponse {
  success?: boolean;
  message?: string;
  data?: {
    roleId?: number;
    roleCode?: string;
    /** Existing company_user_role status, or null when no row exists yet. */
    status?: string | null;
    isProfileCompleted?: boolean;
    rejectionReason?: string | null;
    fields?: SwitchRoleFieldMeta[];
  };
}

/**
 * Response from `POST /auth/request-role-switch`.
 *
 * A first-time submit answers `success: true` with status Pending. Already-
 * pending or rejected roles come back as `success: false` at **HTTP 200**.
 * Incomplete required fields are HTTP **400** with `missingFields`.
 */
export interface RequestRoleSwitchResponse {
  success?: boolean;
  message?: string;
  data?: {
    status?: string;
    isProfileCompleted?: boolean;
    rejectionReason?: string | null;
    missingFields?: SwitchRoleFieldMeta[];
  };
}

/**
 * Response from `POST /auth/switch-role`.
 *
 * The endpoint answers three outcomes. Pending/rejected come back as
 * `success: false` at **HTTP 200**, so axios resolves them normally. Always
 * branch on `success`, never on the HTTP status:
 *
 *  - approved  → `success: true`,  data: { roleId, role } and the re-issued token
 *                pair set as httpOnly cookies on this response.
 *  - pending   → `success: false`, data: { status: "Pending" }.
 *  - rejected  → `success: false`, data: { status: "Rejected", rejectionReason }.
 */
export interface SwitchRoleResponse {
  success?: boolean;
  message?: string;
  data?: {
    /** Raw role string from the backend; normalize via normalizeRole. */
    role?: string;
    roleId?: number;
    /** "Pending" / "Rejected" — present only when the switch did NOT complete. */
    status?: string;
    rejectionReason?: string | null;
  };
}

/** Body of the HTTP 400 "profile not completed" rejection (read off `ApiError.data`). */
export interface SwitchRoleErrorData {
  message?: string;
  data?: { missingFields?: SwitchRoleFieldMeta[] };
}

/** What the caller of `switchRole()` needs to decide what to show. */
export interface SwitchRoleOutcome {
  /** True only when the role actually changed and new cookies were issued. */
  switched: boolean;
  /** Backend status when it didn't switch — "Pending" / "Rejected". */
  status?: string;
  message?: string;
}

/**
 * Login MFA channel selection. The client only sends the chosen channel; the
 * backend then triggers the OTP send over that channel.
 */
export interface SelectChannelPayload {
  channel: "EMAIL" | "PHONE";
}

/** Response from the MFA select-channel endpoint. */
export interface SelectChannelResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Login MFA OTP verification. `channel` uses the same enum as registration; the
 * user is already authenticated (token), so only the channel + code are sent.
 */
export interface VerifyMfaOtpPayload {
  channel: "EMAIL" | "PHONE";
  otp: string;
}

/**
 * Response from the MFA verify-otp endpoint. The full access+refresh token pair is
 * set as httpOnly cookies directly on this response — the client can no longer
 * decode them, so the backend echoes `userId`/`tokenType` in the body instead
 * (stored via setSession, read by the dashboard guard and deal-room "mine vs theirs").
 */
export interface VerifyMfaOtpResponse {
  success?: boolean;
  message?: string;
  data?: {
    /** Route the backend wants the client to land on after verification. */
    redirectRoute?: string;
    /** Authenticated user's profile, echoed back on successful verification. */
    first_name?: string | null;
    last_name?: string | null;
    /** Raw role string (e.g. "STARTUP"); normalize via normalizeRole. */
    role?: string | null;
    /** The authenticated user's UUID — the token itself is no longer client-readable. */
    userId?: string;
    /** The access token's `type` claim (e.g. "AUTH_ACCESS_TOKEN"), echoed back for the same reason. */
    tokenType?: string;
    /**
     * Raw email/mobile, only present when redirectRoute sends the user to the
     * verify-account page — that page's resend/verify calls need the real (unmasked)
     * values, which the login flow otherwise never captures (SignInScreen only stores
     * masked display strings).
     */
    email?: string;
    mobileNumber?: string;
    countryCode?: string;
    /** The registered company name — locked "Company Name" field on complete-profile. */
    companyName?: string;
    /** Company channel verification flags — used when landing on verify-account after login. */
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
    /**
     * Present when login MFA redirects to verify-account and a registration OTP was
     * just sent for that unverified channel (testing currently echoes the code in
     * the message because SMS/email delivery is disabled).
     */
    emailOtpMessage?: string;
    phoneOtpMessage?: string;
    /**
     * Combined toast string matching registration: "Email OTP - 1234 | Phone OTP - 5678".
     * Only includes channels that actually received a code.
     */
    channelOtpMessage?: string;
  };
}

/* ---- Password reset (standalone flow, all portals) ---- */

/** Step 1: request an OTP to the account email. */
export interface ResetPasswordTriggerOtpPayload {
  email: string;
}
export interface ResetPasswordTriggerOtpResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Step 2: verify the emailed OTP. The short-lived reset token (RESET_PASSWORD_ACCESS_TOKEN)
 * is set as an httpOnly cookie directly on this response, authorizing the step-3 call
 * automatically — nothing token-shaped is in the body.
 */
export interface ResetPasswordVerifyOtpPayload {
  email: string;
  otp: string;
}
export interface ResetPasswordVerifyOtpResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/** Step 3: set the new password (authorized by the reset access token). */
export interface ResetPasswordPayload {
  newPassword: string;
}
export interface ResetPasswordResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/** Payload for verifying a one-time code. Field names/values match the backend schema. */
export interface VerifyOtpPayload {
  /** Which channel the code was sent over. */
  channel: "EMAIL" | "PHONE";
  otp: string;
  /** Required when channel is EMAIL. */
  email?: string;
  /** Required when channel is PHONE. */
  phoneNumber?: string;
}

/** Payload for requesting a fresh OTP. Field names/values match the backend schema. */
export interface ResendOtpPayload {
  /** Which channel to resend the code over. */
  channel: "EMAIL" | "PHONE";
  /** Required when channel is EMAIL. */
  email?: string;
  /** Required when channel is PHONE. */
  phoneNumber?: string;
}

/** Response from the resend-otp endpoint. data is an empty array on success. */
export interface ResendOtpResponse {
  success?: boolean;
  message?: string;
  data?: unknown[];
}

/** Response from an OTP verify endpoint. Tokens are issued at registration, not here; data is an empty array on success. */
export interface VerifyOtpResponse {
  success?: boolean;
  message?: string;
  data?: unknown[];
}

/** Result of a virus scan + S3 upload (`/file/scan-img` | `/file/scan-document`). */
export interface ScanResult {
  /** S3 object key of the stored file; sent back to the backend with the submit payload. */
  s3Key: string;
}

/**
 * Complete-profile payload — keys match the backend `user` table columns exactly
 * (snake_case, flat). All optional: only the fields relevant to the user's role are
 * sent. NOTE: some keys intentionally mirror backend spelling quirks
 * (`prefrerred_investment_stage`, `export_rediness`, `products_ervice_Offered`).
 */
export interface UserProfilePayload {
  // basic
  first_name?: string;
  last_name?: string;
  profile_photo?: string;
  intro_video?: string;
  short_bio?: string;
  country?: string;
  continent?: string;
  organization_name?: string;
  mobile_number?: string;
  /** Dialling code, e.g. "+91". Same column as company registration. */
  country_code?: string;
  company_email?: string;
  linkedin_profile_url?: string;
  company_website_url?: string;
  primary_sector?: string[];
  // startup
  startup_industry_sector?: string[];
  funding_stage?: string;
  funding_currency?: string;
  funding_ask_amt_min?: number;
  funding_ask_amt_max?: number;
  use_of_funds?: string;
  team_size_min?: number;
  team_size_max?: number;
  incorporation_certificate?: string;
  pitch_deck_certificate?: string;
  business_description?: string;
  startup_intent?: string;
  /** Repeatable [{ name, url }] rows — a jsonb column, not two parallel arrays. */
  founders?: { name: string; url: string }[];
  // investor
  ticket_size_amt_min?: number;
  ticket_size_amt_max?: number;
  ticket_currency?: string;
  prefrerred_investment_stage?: string[];
  investor_sector_preference?: string[];
  geographic_investment_preference?: string[];
  /** Continent half of the Geographic Investment Preference widget. */
  geographic_investment_preference_continent?: string[];
  investor_type?: string;
  investor_portfolio_overview?: string;
  investment_thesis?: string;
  number_of_investments_to_date?: number;
  investor_intent?: string;
  // b2b
  b2b_sector?: string;
  b2b_sub_sector?: string;
  business_type?: string;
  industry_vertical?: string;
  revenue_band?: string;
  min_order_quantity?: number;
  export_rediness?: string;
  years_in_operation?: number;
  b2b_geography_country?: string[];
  b2b_geography_continent?: string[];
  products_ervice_Offered?: string;
  business_requirements?: string;
  b2b_intent?: string;
  /** Registered office / residential address — investor + b2b. */
  address?: string;
}

/** Response from `/users/build-profile`. */
export interface BuildProfileResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/**
 * One uploaded file inside a KYC document. `s3_key` comes from the scan upload;
 * `mimetype` / `file_name` / `file_size` describe the uploaded file (the same file
 * the scan API received).
 */
export interface KycDocFile {
  s3_key: string;
  mimetype: string;
  file_name: string;
  file_size: number;
}

/**
 * Payload for `/kyc/save-kyc-info` (document-upload step). Each document carries its
 * typed `number` plus one file object per side. Aadhaar is two-sided (front + back);
 * PAN is single-sided (front only). `number` is sent as a string to preserve PAN's
 * alphanumeric format and Aadhaar's 12 digits / leading zeros.
 *
 * Both keys are optional because a re-upload after a rejection sends only the documents
 * the reviewer rejected; the backend upserts whichever types are present.
 */
export interface SaveKycInfoPayload {
  AADHAAR?: {
    number: string;
    front: KycDocFile;
    back: KycDocFile;
  };
  PAN?: {
    number: string;
    front: KycDocFile;
  };
}

/** Response from `/kyc/save-kyc-info`. */
export interface SaveKycInfoResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}
/**
 * One stored KYC document side returned by `/file/get-kyc-docs`. Carries the same
 * fields the scan upload produced plus the review status the backend tracks.
 */
export interface KycDocEntry {
  number: string;
  front?: KycDocFile;
  back?: KycDocFile;
  status?: string;
  rejection_reason?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
}

/**
 * Stored KYC documents returned by `/file/get-kyc-docs`. The backend sends an array of
 * single-key objects (one per document type), e.g. `[{ AADHAAR: … }, { PAN: … }]`.
 */
export type KycDocDetails = Array<Partial<Record<"AADHAAR" | "PAN", KycDocEntry>>>;

export interface GetKycDocsResponse {
  docDetails: KycDocDetails;
  /** ISO 8601 timestamp of when the documents were submitted. */
  submissionTime: string;
  /** ISO 8601 timestamp of when the review window expires (drives the countdown). */
  expiryTime: string;
  kycStatus?: string | null;
  /** The admin's reason for rejecting. Only set when `kycStatus` is "Rejected". */
  rejectionReason?: string | null;
}

/* ===========================================================================
 * Session Management
 * Shapes used by the active-session limit check and session-chooser modal that
 * runs between MFA OTP verification and the dashboard redirect.
 * ======================================================================== */

/** One active device session returned by GET /api/v1/sessions/limit-status. */
export interface ActiveSession {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  /** ISO 8601 timestamp of the most recent activity on this session. */
  lastActivityAt: string;
  /** ISO 8601 timestamp of when this session was originally created. */
  createdAt: string;
}

/**
 * Response from GET /api/v1/sessions/limit-status. Called after MFA verification
 * succeeds. When `atLimit` is true the session-chooser modal is shown; when false
 * the client proceeds to the dashboard immediately.
 *
 * Note: `activeSessions` never includes the user's current (just-created) session —
 * the backend excludes it. Every item in the list is safe to display as-is.
 */
export interface SessionLimitStatusResponse {
  success?: boolean;
  message?: string;
  data?: {
    /** True when the user has hit the concurrent-session ceiling. */
    atLimit: boolean;
    /**
     * Existing sessions the user may choose to revoke. Empty array when
     * `atLimit` is false.
     */
    activeSessions: ActiveSession[];
  };
}

/** Payload for POST /api/v1/sessions/revoke-selected. */
export interface RevokeSelectedSessionsPayload {
  sessionIds: string[];
}

/** Response from POST /api/v1/sessions/revoke-selected. */
export interface RevokeSelectedSessionsResponse {
  success?: boolean;
  message?: string;
}

/* ===========================================================================
 * Admin / Super-Admin back-office (User Management + KYC Review).
 * Fields are optional/tolerant like the rest of this file — the service layer
 * normalizes the raw backend shape into these before the UI consumes them.
 * ======================================================================== */

/** KYC verification state used across User Management + KYC Review. */
export type KycStatus = "VERIFIED" | "PENDING" | "REJECTED";

/**
 * One row in the User Management table, normalized from the `get-user-list`
 * response. Keyed by `company_email`; `userId` carries the UUID needed
 * for per-user admin operations (e.g. limit-config).
 */
export interface AdminUserListItem {
  /** Stable identifier — `company_email`. */
  id: string;
  /** UUID from the `user` table — used for admin per-user API calls. */
  userId?: string;
  /** `first_name + last_name`, falling back to company name / email. */
  name: string;
  /** `company_email`. */
  email: string;
  companyName?: string;
  countryCode?: string | null;
  mobileNumber?: string;
  /** Normalized from the backend `role` (e.g. "STARTUP" → "startup"); null if unknown. */
  role: Role | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  /** Derived from the backend company `kyc_status` column: Approved → VERIFIED, Rejected →
   *  REJECTED, otherwise PENDING. Per-document `kyc_info.status` is not used. */
  kycStatus: KycStatus;
  /**
   * True when the user has at least one Aadhaar/PAN row in `kyc_info` (same gate as
   * KYC Review's `documents.length > 0`). Existence only — not document approve/reject.
   */
  hasKycDocuments: boolean;
  /** `company_id` — required alongside `userId` by the suspension endpoint. */
  companyId?: string;
  /** Stored profile-picture key (`user.profile_photo`); undefined = show initials. */
  photoKey?: string | null;
  /** Account state, derived from the user's active flag. */
  suspended: boolean;
}

/** Body of PUT /admin/users/suspension. `suspensionReason` is required when suspending. */
export interface UserSuspensionPayload {
  userId: string;
  companyId?: string;
  isSuspended: boolean;
  suspensionReason?: string;
}

/** The full `get-user-list` list (no pagination metadata from the backend yet). */
export interface AdminUserListResponse {
  data: AdminUserListItem[];
  total: number;
}

/**
 * One role-specific field on the admin user-detail drawer, resolved server-side
 * against `role_field_metadata` for the user's role — same source as the
 * user-facing `USER_ROLE_DETAILS` endpoint.
 */
export interface AdminUserDetailField {
  fieldName: string;
  label: string;
  value: string | number | boolean | string[] | null;
  datatype?: string;
  unit?: string | null;
  displayOrder?: number;
}

/** Latest suspend/reactivate action from `user_suspension_history`, if any. */
export interface AdminUserSuspensionInfo {
  isSuspended: boolean;
  lastAction: "suspended" | "reactivated" | null;
  reason: string | null;
  actionBy?: string | null;
  actionAt?: string | null;
  /** True when the last action was applied by a super admin (a plain admin can't override it). */
  isLockedBySuperAdmin: boolean;
}

/**
 * Full detail fetched on-demand by GET /admin/users/:userId when the "View Profile"
 * drawer opens — role-shaped profile fields plus the latest suspension/reactivation
 * reason. Distinct from `AdminUserListItem`, which only carries the list-row columns.
 */
export interface AdminUserDetail {
  userId: string;
  firstName?: string;
  lastName?: string;
  /** Stored profile-picture key (`user.profile_photo`); undefined = show initials. */
  profilePhoto?: string | null;
  companyId: string;
  companyName?: string;
  email: string;
  countryCode?: string | null;
  mobileNumber?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  kycStatus: KycStatus;
  roleId: number;
  roleName?: string;
  roleCode: string;
  fields: AdminUserDetailField[];
  suspension: AdminUserSuspensionInfo;
  /** Full suspend/reactivate history for this user, newest first. `suspension` above mirrors index 0. */
  suspensionHistory: AdminUserSuspensionInfo[];
}

/** KYC review state used by the tabs/list + per-document status. */
export type KycReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/** One uploaded side of a document (front/back), viewed via the file-preview flow. */
export interface KycDocumentSide {
  /** Display label, e.g. "Front" / "Back". */
  label: string;
  s3Key: string;
  fileName?: string;
}

/** One KYC document (AADHAAR / PAN) with its file(s) + per-document review state. */
export interface KycDocument {
  kycId: number;
  /** Document type, e.g. AADHAAR / PAN. */
  type: string;
  /** The typed document number (Aadhaar / PAN), from `document_number`. */
  documentNumber?: string;
  status: KycReviewStatus;
  rejectionReason?: string | null;
  uploadedAt?: string;
  verifiedAt?: string | null;
  /** Front (and, for AADHAAR, back) files. */
  sides: KycDocumentSide[];
}

/**
 * One KYC submission row, normalized from `get-user-kyc_docs`. That response
 * already carries the full document set, so the review drawer reuses this record
 * directly (no separate detail fetch).
 */
export interface KycSubmissionListItem {
  /** Stable identifier — backend `uid`. */
  id: string;
  /** Backend `company_id` (UUID) — the key the overall review-action endpoint expects. */
  companyId?: string;
  applicantName: string;
  /** Stored profile-picture key (`user.profile_photo`); undefined = show initials. */
  photoKey?: string | null;
  email?: string;
  countryCode?: string | null;
  phone?: string;
  organizationName?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  /** Company-level KYC (`kyc_status` / `is_kyc_verified`). Drives the list tabs. */
  status: KycReviewStatus;
  /** Company-level reject note (`kyc_rejection_reason`). Set only after account reject. */
  rejectionReason?: string | null;
  /** Earliest document upload time (ISO 8601). */
  submittedAt?: string;
  documents: KycDocument[];
}

/** The full `get-user-kyc_docs` list (no pagination metadata from the backend yet). */
export interface KycSubmissionListResponse {
  data: KycSubmissionListItem[];
  total: number;
}

/** Tabs/search filter for the KYC Review list (applied client-side). */
export interface KycSubmissionListParams {
  status?: "all" | "pending" | "approved" | "rejected";
  search?: string;
}

/** Payload for the approve / reject / request-info review action (API is TBD). */
export interface ReviewKycPayload {
  action: "APPROVE" | "REJECT" | "REQUEST_INFO";
  note?: string;
}

/** Response from the KYC review action. */
export interface ReviewKycResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}
/* ------------------------------------------------------------------ *
 * Explore — Matching Engine results (swipe deck + grid)
 * Mirrors the `/matches` response: a list of compatibility matches for the
 * current profile. Components consume `ExploreMatch` (the `data.matches[]` item).
 * ------------------------------------------------------------------ */
/** The matched company's account type, as returned by the backend (uppercase). */
export type ExploreMatchRole = "INVESTOR" | "B2B" | "STARTUP";

/**
 * One compatibility match — the shape of each `data.matches[]` entry. Keys mirror
 * the backend exactly (snake_case, incl. spelling quirks like `prefrerred_*`,
 * `export_rediness`, `products_ervice_Offered`). Role-specific blocks are optional:
 * only the fields for that match's `role` are present.
 */
export interface ExploreMatch {
  // ---- common ----
  /** UUID of the matched user. */
  profileId: string;
  /** Recipient identifiers used when sending a connection request. */
  roleId: number;
  /** UUID of the matched company. */
  companyId: string;
  role: ExploreMatchRole;
  /** Overall compatibility score, 0–100. */
  compatibility: number;
  first_name: string | null;
  last_name: string | null;
  /** Background photo when present; otherwise the card shows an initials avatar. */
  profile_photo: string | null;
  /** Company name (used as the card title). */
  organization_name: string;
  short_bio: string | null;
  country: string | null;
  continent: string | null;
  /** Sector tags shown as chips. */
  primary_sector: string[];
  /** AI-generated explanation of why this profile was matched. */
  rationale?: string | null;
  linkedin_profile_url?: string | null;
  linkedin_url?: string | null;
  company_website_url?: string | null;
  company_email?: string | null;
  country_code?: string | null;
  mobile_number?: string | null;

  // ---- investor-specific (present when role === "INVESTOR") ----
  ticket_size_amt_min?: number;
  ticket_size_amt_max?: number;
  prefrerred_investment_stage?: string[];
  stage_focus?: string | null;
  investor_sector_preference?: string[];
  geographic_investment_preference?: string[];
  investor_type?: string;
  investor_portfolio_overview?: string | null;
  number_of_investments_to_date?: number;
  investor_intent?: string;

  // ---- b2b-specific (present when role === "B2B") ----
  b2b_sector?: string;
  b2b_sub_sector?: string;
  revenue_band?: string;
  min_order_quantity?: number;
  export_rediness?: string;
  industry_vertical?: string;
  years_in_operation?: number;
  operational_capacity_description?: string | null;
  products_ervice_Offered?: string;
  business_requirements?: string;
  b2b_intent?: string;
}

/** Raw envelope returned by the matches endpoint. */
export interface ExploreMatchesResponse {
  success: boolean;
  data: {
    /** The UUID of the profile these matches were computed for. */
    profileId: string;
    matches: ExploreMatch[];
    /** Daily connection-request cap for the current profile. */
    requestLimit?: number;
    /** Requests still available today. */
    requestsRemaining?: number;
    /** Requests already sent within the current window. */
    requestsSentInWindow?: number;
  };
  message: string;
}

/* ------------------------------------------------------------------ *
 * Navbar search — GET /api/v1/users/search
 * (the paired GET /api/v1/users/role-details returns `{ fields, connection_status }`
 * — see services/user.service.ts)
 * ------------------------------------------------------------------ */
/** One suggestion row returned by GET /api/v1/users/search?q=. */
/**
 * One role a user holds, as returned by the admin role-switch review list. The backend
 * emits a row per role and only for users holding more than one, so a user with an added
 * role appears once per role — their original plus each switch they've requested.
 * Reuses `KycReviewStatus` because the backend writes the same Pending/Approved/Rejected
 * values for both flows.
 */
export interface RoleSwitchRequest {
  /** `company_user_role.id` — the id the approve/reject endpoint expects. */
  companyUserRoleId: number;
  userId: string;
  companyId?: string;
  userName: string;
  email?: string;
  companyName?: string;
  /** Stored `profile_photo` key, for the shared `Avatar`. */
  photoKey?: string | null;
  /** `company_role_master.id` — needed to fetch this row's profile in the drawer. */
  roleId: number;
  /** Role code (STARTUP / INVESTOR / B2B) of this particular row. */
  roleCode: string;
  roleName?: string;
  /** True for the role the account was originally created with. */
  isDefaultRole: boolean;
  status: KycReviewStatus;
  /** Whether the user finished the target role's extra profile fields. */
  isProfileCompleted: boolean;
  rejectionReason?: string | null;
  switchedAt?: string | null;
  approvedAt?: string | null;
}

export interface UserSearchResult {
  /** UUID of the matched user. */
  user_id: string;
  role_id: number;
  /** Backend role code (`STARTUP` / `INVESTOR` / `B2B`). */
  role?: string;
  /** Display name from `company_role_master`. */
  role_name?: string;
  /** UUID of the matched company. */
  company_id: string;
  first_name: string;
  last_name: string;
  /** Stored profile-picture key (`user.profile_photo`); null = show initials. */
  profile_photo?: string | null;
  company_name: string;
  email: string;
  mobile_number: string;
  country: string;
  continent: string;
  /**
   * Live blocking connection with the viewer for this role pair
   * (`Pending` / `Viewed` / `Accepted` / `Deferred`), or null when none exists.
   */
  connection_status?: string | null;
}

/** A swipe decision on a match card. */
export type ExploreDecision = "reject" | "skip" | "send";

/** Body sent to POST /api/v1/connection (keys per backend). */
export interface SendConnectionRequestPayload {
  /** UUID of the recipient user. */
  recipientUserId: string;
  recipientRoleId?: number;
  /** UUID of the recipient company. */
  recipientCompanyId?: string;
  personalMessage: string;
  bussinessIntent: string[];
  expectedDealSize: string;
  productServiceDetails: string;
}

/** Response from POST /api/v1/connection. */
export interface SendConnectionRequestResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

/** Lifecycle status of a connection request. */
export type ConnectionStatus =
  | "PENDING"
  | "VIEWED"
  | "ACCEPTED"
  | "DECLINED"
  | "DEFERRED"
  | "WITHDRAWN"
  | "EXPIRED";

/** Whether I'm the recipient (received) or the sender (sent) of the request. */
export type ConnectionDirection = "received" | "sent";

/** One connection request as shown in the Connections screen (list + detail). */
export interface ConnectionRequest {
  id: string;
  direction: ConnectionDirection;
  name: string;
  company: string;
  role: Role;
  /** Stored profile-picture key (`user.profile_photo`); undefined = show initials. */
  photoKey?: string | null;
  intent: string;
  message?: string;
  productServiceDetails?: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

/** Actions a user can take on a request (UI-level). */
export type ConnectionActionType = "ACCEPT" | "DECLINE" | "DEFER" | "WITHDRAW";

/** Body for the change-status API. `status` is the backend's title-case value
 *  (e.g. "Accepted"), translated from our internal uppercase status. */
export interface ConnectionActionPayload {
  connectionId: number;
  status: string;
  reason?: string;
}

export interface ConnectionActionResponse {
  success: boolean;
  message: string;
  data?: {
    connection?: { id: string | number; status: ConnectionStatus };
    deal_room_id?: string | number | null;
  };
}

/** Response from GET /api/v1/connections?direction=. */
export interface ConnectionsListResponse {
  success: boolean;
  message: string;
  data: ConnectionRequest[];
}

/* ===========================================================================
 * User Limit Config — admin-configurable per-user connection limits.
 * Managed via GET/PUT /api/v1/admin/users/:userId/limit-config.
 * ======================================================================== */

/**
 * Per-user limit configuration returned by the admin limit-config endpoint.
 * `is_custom` is true when an admin has saved custom values; false means the
 * values shown are the system-wide defaults.
 */
export interface UserLimitConfig {
  /** UUID of the user this config belongs to. */
  user_id: string;
  allowed_connections: number;
  allowed_free_trial_days: number;
  allowed_premium_days: number;
  /** False when no custom config has been saved yet (defaults are returned). */
  is_custom: boolean;
  /** True when the user has an active, non-expired subscription. */
  has_subscription: boolean;
  /** Sent only on the subscription branch. */
  is_subscription_expired?: boolean;
}

/**
 * Payload for PUT /api/v1/admin/users/:userId/limit-config.
 * All fields are optional — at least one must be provided (enforced by the backend).
 */
export interface UpdateUserLimitConfigPayload {
  allowed_connections?: number;
  allowed_free_trial_days?: number;
  allowed_premium_days?: number;
}

/* ===========================================================================
 * FAQs — user-facing
 * Fetched from GET /api/v1/faqs (active FAQs only).
 * ======================================================================== */

/** One FAQ entry returned by GET /api/v1/faqs. */
export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

/** Raw envelope returned by GET /api/v1/faqs. */
export interface FaqListResponse {
  success?: boolean;
  message?: string;
  data?: FaqItem[];
}

/* ===========================================================================
 * Admin FAQ Management
 * Managed via GET/POST /api/v1/admin/faqs and PUT /api/v1/admin/faqs/:id
 * ======================================================================== */

/**
 * One FAQ row as returned by the admin list endpoint.
 * Includes is_active so the admin can see and toggle each entry's status.
 */
export interface AdminFaqItem {
  id: number;
  question: string;
  answer: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}


export interface AdminFaqListData {
  faqs: AdminFaqItem[];
  isAllowdToUpsert: boolean;
}

/** Raw envelope returned by GET /api/v1/admin/faqs. */
export interface AdminFaqListResponse {
  success?: boolean;
  message?: string;
  data?: AdminFaqListData;
}

/** Payload for POST /api/v1/admin/faqs (create). */
export interface CreateFaqPayload {
  question: string;
  answer: string;
  is_active: boolean;
}

/**
 * Payload for PUT /api/v1/admin/faqs/:id (update).
 * All fields are optional — at least one must be provided.
 */
export interface UpdateFaqPayload {
  question?: string;
  answer?: string;
  is_active?: boolean;
}

/** Response envelope from create / update FAQ actions. */
export interface FaqActionResponse {
  success?: boolean;
  message?: string;
  data?: { id?: number };
}

/* ===========================================================================
 * Subscription Plans
 * GET  /api/v1/subscriptions/plans   — list active plans
 * POST /api/v1/subscriptions/select  — select a plan  { plan_id }
 * GET  /api/v1/subscriptions/my      — current user's active subscription
 * ======================================================================== */
 
/**
 * One plan row returned by GET /api/v1/subscriptions/plans.
 * valid_till_preview is computed server-side as today + validity_days (ISO date).
 */
export interface SubscriptionPlan {
  id: number;
  plan_name: string;
  plan_benefits: string[];
  validity_days: number;
  /** ISO date string (YYYY-MM-DD): what end_date would be if subscribed today. */
  valid_till_preview: string;
}
 
/** Envelope returned by GET /api/v1/subscriptions/plans. */
export interface SubscriptionPlansResponse {
  success?: boolean;
  message?: string;
  data?: SubscriptionPlan[];
}
 
/** Payload for POST /api/v1/subscriptions/select. */
export interface SelectPlanPayload {
  plan_id: number;
}
 
/** Envelope returned by POST /api/v1/subscriptions/select. */
export interface SelectPlanResponse {
  success?: boolean;
  message?: string;
  data?: {
    subscription_id: number;
    plan_name: string;
    start_date: string;
    end_date: string;
    status: "pending" | "active" | "expired" | "cancelled";
  };
}
 
/** Shape returned by GET /api/v1/subscriptions/my. */
export interface UserSubscriptionData {
  subscription_id: number;
  plan_id: number;
  plan_name: string;
  plan_benefits: string[];
  start_date: string;
  end_date: string;
  status: "pending" | "active" | "expired" | "cancelled";
}
 
/** Envelope returned by GET /api/v1/subscriptions/my. */
export interface UserSubscriptionResponse {
  success?: boolean;
  message?: string;
  data?: UserSubscriptionData;
}

export interface MatchingEngineConnectionBreakdown {
  status: string;
  count: number;
}
 
export interface ZeroEngagementProfile {
  userId: string;
  name: string;
  role: string;
  company: string;
  joinedAt: string | null;
  /** Stored profile-picture key (`user.profile_photo`); null = show initials. */
  profilePhoto?: string | null;
}
 
export interface MatchingEngineAlgorithmDistribution {
  algorithmType: string;
  count: number;
  /** Percentage of total shown matches (0–100) */
  percentage: number;
}
 
export interface MatchingEngineBehavioralSignal {
  /** 'skipped' | 'irrelevant_flag' | 'connection_sent' | 'deal_room_opened' */
  action: string;
  count: number;
}
 
export interface MatchingEngineTopSector {
  sector: string;
  count: number;
}
 
export interface MatchingEngineStats {
  // ── From existing tables (connection, deal_room, user) ──
  totalProfiles: number;
  totalConnections: number;
  acceptedConnections: number;
  acceptanceRate: number;
  activeDealRooms: number;
  connectionStatusBreakdown: MatchingEngineConnectionBreakdown[];
  zeroEngagementProfiles: ZeroEngagementProfile[];
 
  // ── From matching_events table (FRD 12.3 new metrics) ──
  matchesGenerated: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  /** null = no data yet (matching_events table is empty) */
  avgCompatibilityScore: number | null;
  topSectorsByVolume: MatchingEngineTopSector[];
  algorithmDistribution: MatchingEngineAlgorithmDistribution[];
  behavioralSignals: MatchingEngineBehavioralSignal[];
}
/* ----- Super Admin: System Management ----- */

/**
 * One row of `otp_config_master` as returned by GET /super-admin/config/otp-config.
 * `lookup` is the backend's key (SENT_OTP_TTL, MAX_OTP_VERIFY_ATTEMPTS, …) and is the
 * key the UI labels the field with and the key the PUT body is built from — the screen
 * never invents its own names for these settings.
 */
export interface OtpConfigEntry {
  id: number;
  /** Backend key, e.g. "SENT_OTP_TTL". Doubles as the field label. */
  lookup: string;
  /** Current value. Kept as a string — the backend column is a varchar. */
  value: string;
  /** Shipped value, the "Reset Defaults" target for this row. */
  defaultValue: string;
  /** "integer" | "boolean" | … — decides which control renders. */
  dataType: string;
  /** "second" | "number" | … — shown next to the label. */
  unit: string;
  description?: string;
  updatedAt?: string;
}

/**
 * Trial window + conversion behaviour (System Management → Trial Management).
 * Field names mirror the backend's `trialConfig` keys one-for-one — `freeTrialDay` is
 * `free_trial_day`, and so on — so the mapping stays obvious.
 */
export interface TrialSettings {
  freeTrialDay: number;
  freeTrialConnectionLimit: number;
  manualExtension: boolean;
  autoDowngrade: boolean;
  expiryNotification: boolean;
}

/** Global feature flags (System Management → Platform Controls). */
export interface PlatformFlags {
  maintenanceMode: boolean;
  registrationOpen: boolean;
  aiMatchingEngine: boolean;
  geoLocationMatching: boolean;
  awsS3Storage: boolean;
}

/**
 * NOTE: there is deliberately no composite `SystemSettings` type. Each card on the System
 * Management screen owns its own GET/PUT pair and edits independently, so the three shapes
 * above are kept separate.
 */

/* ----- Super Admin: Admin Management ----- */

export type AdminAccountStatus = "ACTIVE" | "SUSPENDED";

/** One staff account in the Admin Management table. */
export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  countryCode?: string | null;
  role: "admin" | "super_admin";
  /** Named permission preset, e.g. "Compliance Analyst". */
  roleProfile?: string;
  /** Module keys this admin can reach — empty for a super admin (implicitly all). */
  permissions: string[];
  status: AdminAccountStatus;
  createdAt?: string;
  lastLoginAt?: string;
  /** Id of the admin who created this account. */
  createdBy?: string;
  /** Soft-delete flag; the list filters these out, the drawer surfaces it. */
  isDeleted?: boolean;
}

/** One permission row from the admin detail endpoint — granted or explicitly denied. */
export interface AdminPermission {
  id: string;
  /** Backend key, e.g. "KYC_REVIEW". */
  permissionKey: string;
  isAllowed: boolean;
}

/** One entry in an admin's audit trail (created / updated / suspended / activated…). */
export interface AdminActivityLog {
  id: string;
  /** e.g. "CREATED", "SUSPENDED". */
  action: string;
  /** Supplied on actions that require one (suspend / delete). */
  reason?: string;
  createdAt?: string;
  /** The account the action was performed on. */
  adminId?: string;
  /** Free-form snapshot of what changed — shape varies by action. */
  metadata?: Record<string, unknown>;
  /** The admin who performed the action, when the backend expands it. */
  performedBy?: {
    id?: string;
    name: string;
    email?: string;
    role?: string;
  };
}

/**
 * GET /admin/management/admins/:id — the account plus its permission matrix and audit
 * trail. Powers the detail drawer; the list response carries neither of the latter two.
 */
export interface AdminDetail {
  admin: AdminAccount;
  permissions: AdminPermission[];
  activityLogs: AdminActivityLog[];
}

/**
 * Editable fields of an existing admin (PUT /admin/management/admins/:id). Email, role and
 * status are NOT updatable here — the schema rejects them. At least one field is required.
 */
export interface UpdateAdminPayload {
  name?: string;
  countryCode?: string;
  mobileNumber?: string;
  permissions?: { permissionKey: string; isAllowed: boolean }[];
}

/** Body of the "Create New Admin" form. */
export interface CreateAdminPayload {
  name: string;
  email: string;
  mobileNumber: string;
  /** Dialling code sent as `country_code`, e.g. "+91". */
  countryCode: string;
  password: string;
  /**
   * Every module with its granted/denied state — the backend takes the full matrix, not
   * just the granted keys, so an unticked module is sent as `is_allowed: false`.
   */
  permissions: { permissionKey: string; isAllowed: boolean }[];
  /**
   * UI-only. The create endpoint's Joi schema rejects unknown keys, so this is NOT sent
   * until the backend accepts it.
   */
  sendWelcomeEmail: boolean;
}
