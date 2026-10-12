/** Shared API version prefix — change here to bump the whole API version. */
const BASE = "/api/v1";

/** Path prefix per API group — change/add groups here. */
const AUTH = `${BASE}/auth`;
const ADMIN_AUTH = `${BASE}/admin/auth`;
const SUPERADMIN_AUTH = `${BASE}/superadmin/auth`;
const FILE = `${BASE}/file`;
const USERS = `${BASE}/users`;
const SESSIONS = `${BASE}/sessions`;
// const KYC = `${BASE}/kyc`;
// Admin/super-admin back-office (User Management + KYC Review).
const ADMIN = `${BASE}/admin`;
// Super Admin only — platform configuration (System Management).
const SUPER_ADMIN = `${BASE}/super-admin`;
// Super Admin only — staff accounts (Admin Management). Every route in this group is
// `/admins`-scoped: list, detail, create, update, delete, suspend, activate.
const ADMIN_MANAGEMENT = `${ADMIN}/management`;
// Matching Engine (Explore — compatibility matches).
const MATCHING = `${BASE}/matching`;
// Connection requests (proposals sent to matched profiles).
const CONNECTIONS = `${BASE}/connections`;
// Deal Rooms (chat workspaces spawned from an accepted connection).
const DEAL_ROOMS = `${BASE}/deal-rooms`;
// Meetings scheduled inside a deal room.
const MEETINGS = `${BASE}/meetings`;
// FAQs — active FAQ entries visible to all logged-in users.
const FAQS = `${BASE}/faqs`;
// SUBSCRIPTIONS — user subscription.
const SUBSCRIPTIONS = `${BASE}/subscriptions`;

/** API endpoint paths (relative to NEXT_PUBLIC_API_BASE_URL host). */
export const API_ENDPOINTS = {
  // TODO: replace with the real register path from the curl.
  REGISTER: `${AUTH}/company-registration`,
  // Checks a GSTIN against sandbox.co.in — called when the GST field loses focus
  // on the registration form, ahead of the full submit.
  VERIFY_GST: `${AUTH}/verify-gst`,
  // Checks a CIN — mirrors VERIFY_GST. Currently backed by a fixed mock response
  // on the backend pending a real CIN verification API.
  VERIFY_CIN: `${AUTH}/verify-cin`,
  // TODO: replace with the real login path from the curl.
  LOGIN: `${AUTH}/login`,
  // Login MFA: client sends the chosen channel; backend triggers the OTP send.
  MFA_SELECT_CHANNEL: `${AUTH}/mfa/trigger-otp`,
  // Login MFA: verify the OTP the user entered for the chosen channel.
  MFA_VERIFY_OTP: `${AUTH}/mfa/verify-otp`,
  // Password reset (standalone flow, all portals): trigger an OTP to the email,
  // verify it (returns a short-lived reset access token), then set the new password.
  RESET_PASSWORD_TRIGGER_OTP: `${AUTH}/reset-password/trigger-otp`,
  RESET_PASSWORD_VERIFY_OTP: `${AUTH}/reset-password/verify-otp`,
  RESET_PASSWORD: `${AUTH}/reset-password`,
  // Admin auth — same login + MFA flow, admin-prefixed paths.
  ADMIN_LOGIN: `${ADMIN_AUTH}/login`,
  ADMIN_MFA_SELECT_CHANNEL: `${ADMIN_AUTH}/mfa/trigger-otp`,
  ADMIN_MFA_VERIFY_OTP: `${ADMIN_AUTH}/mfa/verify-otp`,
  // Super-admin auth — same login + MFA flow, superadmin-prefixed paths.
  SUPERADMIN_LOGIN: `${SUPERADMIN_AUTH}/login`,
  SUPERADMIN_MFA_SELECT_CHANNEL: `${SUPERADMIN_AUTH}/mfa/trigger-otp`,
  SUPERADMIN_MFA_VERIFY_OTP: `${SUPERADMIN_AUTH}/mfa/verify-otp`,
  // Preview the target role's filled/unfilled fields (no company_user_role write).
  SWITCH_ROLE_DETAILS: `${AUTH}/switch-role-details`,
  // Save target-role profile fields and create a pending completed role row.
  REQUEST_ROLE_SWITCH: `${AUTH}/request-role-switch`,
  // Switch the active user role — backend re-issues a new access token for an
  // already-approved role.
  SWITCH_ROLE: `${AUTH}/switch-role`,
  // TODO: replace with the real OTP verify paths from the curls.
  VERIFY_MOBILE_OTP: `${AUTH}/verify-otp`,
  VERIFY_EMAIL_OTP: `${AUTH}/verify-otp`,
  RESEND_OTP: `${AUTH}/resend-otp`,
  // Virus-scan + S3 upload (returns { s3Key }).
  SCAN_IMG: `${FILE}/scan-img`,
  SCAN_DOCUMENT: `${FILE}/scan-document`,
  SCAN_VIDEO: `${FILE}/scan-video`,
  // Signed, short-lived URL to play a user's intro video.
  VIDEO_URL: `${FILE}/video-url`,
  // Watermarked file preview (returns raw bytes for a given s3Key).
  FILE_PREVIEW: `${FILE}/file-preview`,
  // Create the user profile (complete-profile step). Requires a valid JWT.
  BUILD_PROFILE: `${USERS}/build-profile`,
  // TODO: replace with the real save-kyc-info path from the curl.
  SAVE_KYC_INFO: `${FILE}/save-kyc-info`,
  // Fetch the submitted KYC docs + submission/expiry timestamps (verification-status step).
  GET_KYC_DOCS: `${FILE}/get-kyc-docs`,

  // ----- Session Management -----
  // Check whether the user is at their active-session limit (called after MFA
  // verify, before the dashboard redirect). The access token is sent via the
  // shared axios interceptor — no extra headers needed at the call site.
  SESSION_LIMIT_STATUS: `${SESSIONS}/limit-status`,
  // Revoke one or more sessions by id (called from the session-chooser modal).
  REVOKE_SELECTED_SESSIONS: `${SESSIONS}/revoke-selected`,
  // Revoke current session (sidebar logout button).
  SESSION_LOGOUT: `${SESSIONS}/logout`,

  // ----- Admin / Super-Admin Session Management -----
  // Same flow as user sessions but hits the admin-scoped endpoints.
  // Both "admin" and "superadmin" portals use these routes — the backend
  // distinguishes ADMIN vs SUPER_ADMIN via the token's userType claim.
  ADMIN_SESSION_LIMIT_STATUS: `${ADMIN}/sessions/limit-status`,
  ADMIN_REVOKE_SELECTED_SESSIONS: `${ADMIN}/sessions/revoke-selected`,
  ADMIN_SESSION_LOGOUT: `${ADMIN}/sessions/logout`,

  // ----- Dashboard APIs -----
  // Fetch role-specific dashboard stats for the logged-in user (GET).
  // Returns profile summary + stat counters (connections, deal rooms, documents, etc).
  USER_DASHBOARD: `${USERS}/dashboard`,

  // Fetch admin dashboard KPIs — user counts, KYC pipeline, recent activity (GET).
  ADMIN_DASHBOARD: `${ADMIN}/dashboard`,

  // Fetch super admin platform-wide KPIs — users, orgs, KYC, active today, etc (GET).
  SUPER_ADMIN_DASHBOARD: `${SUPER_ADMIN}/dashboard`,

  // ----- Admin / Super-Admin Self-Service Profile -----
  // Fetch the signed-in admin's own profile (GET).
  ADMIN_GET_PROFILE: `${ADMIN}/profile`,
  // Save/update the signed-in admin's own profile (PUT).
  ADMIN_SAVE_PROFILE: `${ADMIN}/profile`,

  // ----- Admin / Super-Admin back-office -----
  // User Management list + detail. TODO: replace with the real paths from the curl.
  ADMIN_USERS: `${ADMIN}/get-user-list`,
  ADMIN_USER_DETAIL: (id: string) => `${ADMIN}/users/${id}`,
  // Suspend / reactivate a user (PUT). Body: { userId, companyId, isSuspended,
  // suspensionReason } — the reason is required only when suspending.
  ADMIN_USER_SUSPENSION: `${ADMIN}/users/suspension`,
  // Role-switch review — every user holding more than one company role, one row per
  // role (GET). Approve / reject one of those rows with ADMIN_ROLE_SWITCH_ACTION.
  ADMIN_SWITCHED_ROLES: `${ADMIN}/users/switched-roles`,
  // The profile behind one role-switch request (GET ?userId=&companyId=&roleId=).
  // Returns the same `ProfileField[]` shape as GET /users/profile, resolved for the
  // role being reviewed — what the review drawer shows.
  ADMIN_ROLE_SWITCH_DETAILS: `${ADMIN}/users/role-switch-details`,
  // Approve / reject an added role (PUT, body: { companyUserRoleId, action:
  // "approve"|"reject", rejectionReason? } — reason required only when rejecting).
  ADMIN_ROLE_SWITCH_ACTION: `${ADMIN}/users/role-switch-action`,
  // KYC Review list — returns every user with their `kyc_documents` inline, so the
  // review drawer reuses the list row (no separate detail endpoint).
  ADMIN_KYC: `${ADMIN}/get-user-kyc_docs`,
  // Approve / reject one document (PUT, body: { kyc_id, action: "approve"|"reject" }).
  ADMIN_KYC_DOC_ACTION: `${ADMIN}/kyc/document-action`,
  // Approve / reject a whole submission (PUT, body: { company_id, action, rejection_reason? }).
  ADMIN_KYC_REVIEW_ACTION: `${ADMIN}/kyc/review-action`,
  // Per-user connection limit config (GET to fetch, PUT to create/update).
  ADMIN_USER_LIMIT_CONFIG: (id: string) => `${ADMIN}/users/${id}/limit-config`,

  // ----- Admin FAQ Management -----
  // Fetch all FAQs including inactive ones (admin view). GET.
  ADMIN_FAQS: `${ADMIN}/faqs`,
  // Create a new FAQ. POST. Body: { question, answer, is_active }.
  ADMIN_FAQ_CREATE: `${ADMIN}/faqs`,
  // Update an existing FAQ by id. PUT. Body: { question?, answer?, is_active? }.
  ADMIN_FAQ_UPDATE: (id: string) => `${ADMIN}/faqs/${id}`,
  // Matching Engine Dashboard stats (GET).
  ADMIN_MATCHING_ENGINE_STATS: `${ADMIN}/matching-engine/stats`,

  // ----- Super Admin: System Management -----
  // One endpoint pair (GET to fetch, PUT to save) per card on the screen — each section
  // loads and saves independently. The request/response keys live in
  // `services/system-management.service.ts`.
  //
  // OTP Configuration — LIVE. The `otp_config_master` rows.
  // GET → { data: [{ id, lookup, value, default_value, data_type, unit, description }] }
  // PUT → body { otpConfig: { <lookup>: "<value>" } }, partial (only changed keys).
  SUPER_ADMIN_OTP_CONFIG: `${SUPER_ADMIN}/config/otp-config`,
  // Trial Management — LIVE.
  // PUT → body { trialConfig: { free_trial_day, … } }, partial (only changed keys).
  // Reset all OTP config rows to their default_value. PUT, no body.
  SUPER_ADMIN_OTP_CONFIG_RESET: `${SUPER_ADMIN}/config/otp-config/reset`,
  // Trial Management — PLACEHOLDER path, swap in the real one from the curl.
  SUPER_ADMIN_TRIAL_CONFIG: `${SUPER_ADMIN}/config/trial-config`,
  // Platform Controls (feature flags) — PLACEHOLDER path, swap in the real one.
  SUPER_ADMIN_PLATFORM_FLAGS: `${SUPER_ADMIN}/config/platform-flags`,

  // ----- Super Admin: Admin Management -----
  // Staff accounts collection. The GET is LIVE:
  //   GET → { data: { admins: [...], pagination: { total, page, limit, totalPages } } }
  //   Query: page, limit (default 10, max 100), status, search.
  // POST (create) hits the same path. The response keys live in the "Admin Accounts"
  // section of `services/admin.service.ts`.
  ADMIN_ACCOUNTS: `${ADMIN_MANAGEMENT}/admins`,
  // One staff account: GET detail, PUT update (profile and/or permissions), DELETE.
  ADMIN_ACCOUNT: (id: string) => `${ADMIN_MANAGEMENT}/admins/${id}`,
  // Suspend / reactivate an admin. Both are PATCH and both REQUIRE a body
  // { reason } of 5–500 characters.
  ADMIN_ACCOUNT_SUSPEND: (id: string) => `${ADMIN_MANAGEMENT}/admins/${id}/suspend`,
  ADMIN_ACCOUNT_ACTIVATE: (id: string) => `${ADMIN_MANAGEMENT}/admins/${id}/activate`,

   // Matching Engine (log events for analytics)
  MATCHING_LOG_EVENT: `${MATCHING}/events`,

  // ----- Matching Engine (Explore) -----
  // Compatibility matches for a profile. TODO: switch to `${MATCHING}/me`
  // (token-derived) once the backend supports it; for now the profileId is passed.
  MATCHING: () => `${MATCHING}/profiles`,

  // ----- User Profile -----
  // Fetch the current user's profile fields (GET).
  GET_PROFILE: `${USERS}/profile`,
  // Save/update the current user's profile fields (PUT). Also the save behind the
  // switch-role form — the target role's fields are ordinary `user` columns.
  SAVE_PROFILE: `${USERS}/profile`,

  // ----- Navbar search -----
  // Typeahead user search (GET ?q=<query>).
  USERS_SEARCH: `${USERS}/search`,
  // Full role-scoped profile for one search result (GET ?userId=&companyId=&roleId=).
  USER_ROLE_DETAILS: `${USERS}/role-details`,

  // ----- Connections -----
  // Send a connection request (proposal) to a matched profile. POST.
  CONNECTION_CREATE: `${CONNECTIONS}/`,
  // List my connection requests for a direction ("received" | "sent"). GET.
  //   /api/v1/connections/sent   ·   /api/v1/connections/received
  CONNECTIONS_LIST: (direction: string) => `${CONNECTIONS}/${direction}`,
  // Change a request's status (accept / decline / defer / withdraw).
  // body: { connectionId, status }. POST.
  CONNECTION_ACTION: `${CONNECTIONS}/change-status`,

  // ----- Deal Rooms ----- (Bridge-Server: /api/v1/deal-rooms + /:id/messages, JWT)
  // List the current user's deal rooms. GET. Returns flat requester_*/recipient_* rows
  // (each with `archived_at`). Pass `?archived=true` for the caller's archived rooms.
  DEAL_ROOMS_LIST: DEAL_ROOMS,
  // A room's message history (cursor-paginated, newest-first). GET.
  DEAL_ROOM_MESSAGES: (id: string) => `${DEAL_ROOMS}/${id}/messages`,
  // Close a deal room (both sides go read-only). PUT, body: { reason? }.
  DEAL_ROOM_CLOSE: (id: string) => `${DEAL_ROOMS}/${id}/close`,
  // Archive / unarchive a deal room for the CALLER only (per-user view). PUT, no body.
  DEAL_ROOM_ARCHIVE: (id: string) => `${DEAL_ROOMS}/${id}/archive`,
  DEAL_ROOM_UNARCHIVE: (id: string) => `${DEAL_ROOMS}/${id}/unarchive`,
  // Send a FILE/media message. POST multipart: field `media` (+ optional `caption`,
  // `download_allowed` = "true"|"false"). NOTE: TEXT messages go over the socket.
  DEAL_ROOM_SEND_MEDIA: (id: string) => `${DEAL_ROOMS}/${id}/messages/media`,
  // List every file shared in a room (shared-files drawer). GET.
  DEAL_ROOM_FILES: (id: string) => `${DEAL_ROOMS}/${id}/messages/media`,
  // Deferred: authenticated media download GET `.../messages/{messageId}/media`,
  //           read receipts PUT `${DEAL_ROOMS}/${id}/messages/read`.
  // The currently pending stage-update request for a room, if any (survives refresh —
  // request/respond themselves go over the socket, see useDealRoomSocket). GET.
  DEAL_ROOM_STAGE_REQUEST_PENDING: (id: string) => `${DEAL_ROOMS}/${id}/stage-request/pending`,
  // Funding Offer (Stage 2: Negotiation). Bridge-Server calls this "Deal Room Offer"
  // internally (table `deal_room_offer`) — Save Draft/Send/Accept/Reject/Counter all go
  // over the socket (save_offer_draft/send_offer/respond_offer/counter_offer); these
  // two are reads only, mirroring the stage-request pattern.
  DEAL_ROOM_FUNDING_OFFER_CURRENT: (id: string) => `${DEAL_ROOMS}/${id}/offers/current`,
  // Every negotiation thread ever started in this room (all rounds, oldest → newest overall).
  DEAL_ROOM_FUNDING_OFFER_ALL_THREADS: (id: string) => `${DEAL_ROOMS}/${id}/offers/all`,
  // B2B Term Sheet (Stage 2: Negotiation, B2B ↔ B2B only). Mirrors the Funding Offer
  // split: Save goes over the socket (update_term_sheet); these two are reads only,
  // over REST.
  DEAL_ROOM_TERM_SHEET_CURRENT: (id: string) => `${DEAL_ROOMS}/${id}/term-sheet/current`,
  DEAL_ROOM_TERM_SHEET_HISTORY: (id: string) => `${DEAL_ROOMS}/${id}/term-sheet/history`,
  // Full deal-room export. GET — verified against Bridge-Server (dealRoomExportController
  // → dealRoomExportService, route `GET /deal-rooms/:id/export`, participant-only via
  // chatService.authorize). Streams `application/zip` as an attachment (Content-Disposition
  // `deal-room-{id}-export-{ts}.zip`), NOT JSON — fetch it with `responseType: "blob"`
  // (see `exportDealRoom`). Archive layout: `chats/{stage}/messages.txt` transcripts +
  // `media/{stage}/…` files, plus a `missing_files.txt` when an S3 object can't be read.
  DEAL_ROOM_EXPORT: (id: string) => `${DEAL_ROOMS}/${id}/export`,


  // ----- Meetings -----
  // Schedule a meeting inside a deal room. POST.
  MEETING_CREATE: MEETINGS,
  // Upcoming meetings for a deal room (drives the panel's inline preview). GET.
  MEETINGS_UPCOMING: (dealRoomId: string) => `${MEETINGS}/upcoming?dealRoomId=${dealRoomId}`,
  // Every meeting for a deal room (drives the "View All" drawer). GET.
  MEETINGS_LIST: (dealRoomId: string) => `${MEETINGS}?dealRoomId=${dealRoomId}`,
  // A single meeting's full detail (drives the details modal). GET.
  MEETING_DETAIL: (meetingId: string) => `${MEETINGS}/detail?meetingId=${meetingId}`,
  // Update a meeting (partial body — any subset of title/agenda/meetingLink/scheduledAt). PUT.
  MEETING_UPDATE: (meetingId: string) => `${MEETINGS}/update?meetingId=${meetingId}`,

  // ----- FAQs -----
  // Fetch all active FAQs for the logged-in user. GET.
  FAQS,

  // ----- Subscription Plans -----
  // List all active plans (GET). Returns plan_name, plan_benefits, validity_days
  // and a valid_till_preview date (today + validity_days, server-calculated).
  SUBSCRIPTION_PLANS: `${SUBSCRIPTIONS}/plans`,
  // Select a plan for the authenticated user (POST). Body: { plan_id }.
  SUBSCRIPTION_SELECT: `${SUBSCRIPTIONS}/select`,
  // Fetch the authenticated user's active subscription with plan details (GET).
  SUBSCRIPTION_MY: `${SUBSCRIPTIONS}/my`,
} as const;