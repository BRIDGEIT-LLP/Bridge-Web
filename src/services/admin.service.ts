import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import { normalizeRole } from "@/lib/roles";
import type {
  AdminAccount,
  AdminDetail,
  AdminPermission,
  UpdateAdminPayload,
  AdminAccountStatus,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListResponse,
  CreateAdminPayload,
  KycDocument,
  KycDocumentSide,
  KycReviewStatus,
  KycStatus,
  KycSubmissionListItem,
  KycSubmissionListResponse,
  ReviewKycPayload,
  ReviewKycResponse,
  RoleSwitchRequest,
  UserLimitConfig,
  UpdateUserLimitConfigPayload,
  UserSuspensionPayload,
  MatchingEngineStats,
} from "@/types/api.types";
import type { ProfileField } from "@/services/user.service";

/**
 * Admin / super-admin back-office data (User Management + KYC Review). Each function
 * unwraps the raw axios envelope and normalizes it into the typed shapes the UI uses,
 * so the rest of the app never depends on the exact backend keys.
 *
 * Endpoint paths/shapes are placeholders (see `ADMIN_*` in `config/constant.ts`) —
 * swap in the real curl path + adjust the `to*` mappers once the API is final. The
 * access token rides on the httpOnly session cookie.
 */

// ── Admin Self-Service Profile ────────────────────────────────────────────

export interface GetAdminProfileResponse {
  success?: boolean;
  message?: string;
  /** Same ProfileField[] shape as the user profile endpoint. */
  data?: ProfileField[];
}

export interface SaveAdminProfileResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Module-level cache for the signed-in admin's own profile. Mirrors the user
 * profile cache in user.service.ts — collapsed into a single request per TTL
 * window so multiple components don't each issue their own GET on every navigation.
 *
 * A rejection evicts the cache entry immediately so a failed load never sticks
 * and the profile page's Retry button always hits the network.
 */
let adminProfileCache: { at: number; promise: Promise<GetAdminProfileResponse> } | null = null;
const ADMIN_PROFILE_TTL_MS = 5 * 60_000; // 5 minutes

/** Drop the cached admin profile. Called after a save and on logout / role switch. */
export function clearAdminProfileCache(): void {
  adminProfileCache = null;
}

/**
 * Fetch the signed-in admin's own profile fields from GET /api/v1/admin/profile.
 * Auth rides on the httpOnly session cookie (`withCredentials`).
 *
 * Response shape is identical to getUserProfile() (ProfileField[]) so the profile
 * page can reuse all rendering logic regardless of the signed-in role.
 *
 * Served from the module cache when younger than ADMIN_PROFILE_TTL_MS — call
 * `clearAdminProfileCache()` after anything that changes the profile.
 */
export function getAdminProfile(): Promise<GetAdminProfileResponse> {
  if (adminProfileCache && Date.now() - adminProfileCache.at < ADMIN_PROFILE_TTL_MS) {
    return adminProfileCache.promise;
  }

  const promise = api
    .get<GetAdminProfileResponse>(API_ENDPOINTS.ADMIN_GET_PROFILE)
    .then((res) => res.data)
    .catch((err) => {
      // Never cache a failure — drop the entry so the next call (a Retry button,
      // a remount) actually hits the network again.
      adminProfileCache = null;
      throw err;
    });

  adminProfileCache = { at: Date.now(), promise };
  return promise;
}

/**
 * Save changes to the signed-in admin's own editable profile fields
 * via PUT /api/v1/admin/profile.
 *
 * Only name, country_code, and mobile_number are accepted — the backend schema
 * rejects email and role. Clears the cache so the next read reflects the update.
 */
export async function saveAdminProfile(
  payload: Record<string, unknown>
): Promise<SaveAdminProfileResponse> {
  const { data } = await api.put<SaveAdminProfileResponse>(
    API_ENDPOINTS.ADMIN_SAVE_PROFILE,
    payload
  );
  clearAdminProfileCache();
  return data;
}

/**
 * Map the backend company `kyc_status` column (title-case, e.g. "Approved"/"Rejected"/
 * "Pending"/null) to the user-list enum. Driven entirely by company `kyc_status`,
 * never per-document `kyc_info.status`: approved/verified → VERIFIED, rejected →
 * REJECTED, everything else → PENDING.
 */
function toUserKycStatus(status: unknown): KycStatus {
  const s = String(status ?? "").toUpperCase();
  if (s === "APPROVED" || s === "VERIFIED") return "VERIFIED";
  if (s === "REJECTED") return "REJECTED";
  return "PENDING";
}

/** Map one raw `get-user-list` row to our AdminUserListItem. */
function toUserListItem(raw: Record<string, unknown>): AdminUserListItem {
  const first = (raw.first_name as string | null) ?? "";
  const last = (raw.last_name as string | null) ?? "";
  const email = String(raw.company_email ?? "");
  const name = [first, last].filter(Boolean).join(" ").trim() || (raw.company_name as string) || email || "—";
  return {
    id: email || String(raw.id ?? ""),
    // user_id is now a UUID string — coerce to string (was Number() before)
    userId: raw.user_id != null ? String(raw.user_id) : undefined,
    name,
    email,
    companyName: (raw.company_name as string | undefined) ?? undefined,
    countryCode: (raw.country_code as string | null) ?? null,
    mobileNumber: (raw.mobile_number as string | undefined) ?? undefined,
    role: normalizeRole(raw.role),
    emailVerified: Boolean(raw.is_email_verified),
    mobileVerified: Boolean(raw.is_mobile_number_verified),
    kycStatus: toUserKycStatus(raw.kyc_status),
    hasKycDocuments: Boolean(raw.has_kyc_documents),
    companyId: raw.company_id != null ? String(raw.company_id) : undefined,
    photoKey: (raw.profile_photo as string | null) ?? null,
    /*
     * `is_user_suspended` is the ONLY source of truth for the Active/Suspended pill and the
     * Suspend/Reactivate action. It is the column the suspension endpoint writes
     * (Bridge-Server `adminService.js` → `updateUser({ is_user_suspended })`) and the same
     * flag authMiddleware blocks requests on.
     *
     * Do NOT fall back to `is_active`: the list returns both, but they mean different things
     * — `is_active` is whether the account is enabled at all, and a suspended user can still
     * be `is_active: true` (which is exactly why suspended users showed up as "Active").
     */
    suspended: raw.is_user_suspended === true,
  };
}

/**
 * Fetch the full user list (`get-user-list`). The backend returns
 * `{ success, data: [...], message }` with no pagination metadata, so filtering +
 * paging happen client-side in the page for now.
 */
export async function fetchUsers(): Promise<AdminUserListResponse> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN_USERS);
  const rows = ((data?.data ?? data) as Record<string, unknown>[]) ?? [];
  const list = Array.isArray(rows) ? rows : [];
  return { data: list.map(toUserListItem), total: list.length };
}

/**
 * Suspend or reactivate a user. One endpoint for both directions, switched by
 * `isSuspended`. The backend requires `suspensionReason` only when suspending, and a
 * suspension applied by a SUPER_ADMIN can't later be changed by an ADMIN (403).
 */
export async function setUserSuspension(payload: UserSuspensionPayload): Promise<void> {
  await api.put(API_ENDPOINTS.ADMIN_USER_SUSPENSION, {
    userId: payload.userId,
    companyId: payload.companyId,
    isSuspended: payload.isSuspended,
    ...(payload.suspensionReason ? { suspensionReason: payload.suspensionReason } : {}),
  });
}

/** Map one raw suspension/reactivation entry (used for both `suspension` and `suspensionHistory`). */
function toAdminUserSuspensionInfo(rawSuspension: Record<string, unknown>): AdminUserDetail["suspension"] {
  return {
    isSuspended: rawSuspension.isSuspended === true,
    lastAction: (rawSuspension.lastAction as "suspended" | "reactivated" | null) ?? null,
    reason: (rawSuspension.reason as string | null) ?? null,
    actionBy: (rawSuspension.actionBy as string | null) ?? null,
    actionAt: (rawSuspension.actionAt as string | null) ?? null,
    isLockedBySuperAdmin: rawSuspension.isLockedBySuperAdmin === true,
  };
}

/** Map the raw GET /admin/users/:userId response to our AdminUserDetail. */
function toAdminUserDetail(raw: Record<string, unknown>): AdminUserDetail {
  const rawFields = Array.isArray(raw.fields) ? (raw.fields as Record<string, unknown>[]) : [];
  const rawSuspension = (raw.suspension ?? {}) as Record<string, unknown>;
  const rawSuspensionHistory = Array.isArray(raw.suspensionHistory)
    ? (raw.suspensionHistory as Record<string, unknown>[])
    : [];
  return {
    userId: String(raw.userId ?? ""),
    firstName: (raw.firstName as string | undefined) ?? undefined,
    lastName: (raw.lastName as string | undefined) ?? undefined,
    profilePhoto: (raw.profilePhoto as string | null) ?? null,
    companyId: String(raw.companyId ?? ""),
    companyName: (raw.companyName as string | undefined) ?? undefined,
    email: String(raw.email ?? ""),
    countryCode: (raw.countryCode as string | null) ?? null,
    mobileNumber: (raw.mobileNumber as string | undefined) ?? undefined,
    emailVerified: Boolean(raw.emailVerified),
    mobileVerified: Boolean(raw.mobileVerified),
    kycStatus: toUserKycStatus(raw.kycStatus),
    roleId: Number(raw.roleId),
    roleName: (raw.roleName as string | undefined) ?? undefined,
    roleCode: String(raw.roleCode ?? ""),
    fields: rawFields.map((f) => ({
      fieldName: String(f.fieldName ?? ""),
      label: String(f.label ?? ""),
      value: (f.value as string | number | boolean | string[] | null) ?? null,
      datatype: (f.datatype as string | undefined) ?? undefined,
      unit: (f.unit as string | null) ?? null,
      displayOrder: f.displayOrder != null ? Number(f.displayOrder) : undefined,
    })),
    suspension: toAdminUserSuspensionInfo(rawSuspension),
    suspensionHistory: rawSuspensionHistory.map(toAdminUserSuspensionInfo),
  };
}

/**
 * Fetch one user's role-shaped profile fields plus their latest suspension /
 * reactivation reason, for the User Management "View Profile" drawer.
 * `companyId` and `roleCode` come from the list row already loaded on the page
 * (AdminUserListItem) — the backend requires both rather than resolving a
 * "default role" itself.
 */
export async function fetchUserDetail(
  userId: string,
  companyId: string,
  roleCode: string
): Promise<AdminUserDetail> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN_USER_DETAIL(userId), {
    params: { companyId, roleCode },
  });
  return toAdminUserDetail((data?.data ?? {}) as Record<string, unknown>);
}

/* ----- KYC Review ----- */

/** Map a backend doc status string (e.g. "Pending") to our review enum. */
function toReviewStatus(v: unknown): KycReviewStatus {
  const s = String(v ?? "").toUpperCase();
  if (s === "APPROVED" || s === "VERIFIED") return "APPROVED";
  if (s === "REJECTED") return "REJECTED";
  return "PENDING";
}

/** Map one raw `kyc_documents` entry (AADHAAR/PAN) to our KycDocument. */
function toKycDocument(raw: Record<string, unknown>): KycDocument {
  const sides: KycDocumentSide[] = [];
  if (raw.front_s3_key) {
    sides.push({ label: "Front", s3Key: String(raw.front_s3_key), fileName: raw.front_file_name as string | undefined });
  }
  if (raw.back_s3_key) {
    sides.push({ label: "Back", s3Key: String(raw.back_s3_key), fileName: raw.back_file_name as string | undefined });
  }
  return {
    kycId: Number(raw.kyc_id ?? 0),
    type: String(raw.document_type ?? "Document"),
    documentNumber: (raw.document_number as string | undefined) ?? undefined,
    status: toReviewStatus(raw.kyc_status),
    rejectionReason: (raw.rejection_reason as string | null) ?? null,
    uploadedAt: raw.kyc_uploaded_at as string | undefined,
    verifiedAt: (raw.verified_at as string | null) ?? null,
    sides,
  };
}

/** Map one raw `get-user-kyc_docs` user row to a KycSubmissionListItem. */
function toKycSubmission(raw: Record<string, unknown>): KycSubmissionListItem {
  const first = (raw.first_name as string | null) ?? "";
  const last = (raw.last_name as string | null) ?? "";
  const email = String(raw.company_email ?? "");
  const name = [first, last].filter(Boolean).join(" ").trim() || (raw.company_name as string) || email || "—";

  const docsRaw = (raw.kyc_documents as Record<string, unknown>[] | null) ?? [];
  const documents = Array.isArray(docsRaw) ? docsRaw.map(toKycDocument) : [];

  // List tabs filter on COMPANY KYC only (`company.kyc_status` / `is_kyc_verified`).
  // Per-document `kyc_documents[].kyc_status` is display + drawer gating, never the tab.
  const status: KycReviewStatus = raw.is_kyc_verified ? "APPROVED" : toReviewStatus(raw.kyc_status);
  const rejectionReason = (raw.kyc_rejection_reason as string | null) ?? null;
  // Earliest upload time across the documents drives the "Submitted" label.
  const submittedAt = documents
    .map((d) => d.uploadedAt)
    .filter((t): t is string => Boolean(t))
    .sort()[0];

  return {
    id: String(raw.uid ?? email),
    // company_id is now a UUID string — coerce to string (was Number() before)
    companyId: raw.company_id != null ? String(raw.company_id) : undefined,
    applicantName: name,
    photoKey: (raw.profile_photo as string | null) ?? null,
    email,
    countryCode: (raw.country_code as string | null) ?? null,
    phone: (raw.mobile_number as string | undefined) ?? undefined,
    organizationName: (raw.company_name as string | undefined) ?? undefined,
    emailVerified: Boolean(raw.is_email_verified),
    mobileVerified: Boolean(raw.is_mobile_number_verified),
    status,
    rejectionReason,
    submittedAt,
    documents,
  };
}

/**
 * Fetch every KYC submission (`get-user-kyc_docs`). The backend returns the full
 * list (no pagination); only users who actually uploaded documents belong in the
 * review queue, so users with no `kyc_documents` are filtered out. Filtering by
 * tab/search happens client-side in the page.
 */
export async function fetchKycSubmissions(): Promise<KycSubmissionListResponse> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN_KYC);
  const rows = ((data?.data ?? data) as Record<string, unknown>[]) ?? [];
  const list = Array.isArray(rows) ? rows : [];
  const submissions = list.map(toKycSubmission).filter((s) => s.documents.length > 0);
  return { data: submissions, total: submissions.length };
}

/**
 * Approve / reject a whole KYC submission via `review-action` (PUT). The backend
 * keys on `company_id`; a reject must carry a `rejection_reason` (the admin note).
 * `companyId` is now a UUID string.
 */
export async function reviewKyc(companyId: string, payload: ReviewKycPayload): Promise<ReviewKycResponse> {
  const body: Record<string, unknown> = {
    company_id: companyId,
    action: payload.action.toLowerCase(),
  };
  if (payload.action === "REJECT") body.rejection_reason = payload.note;
  const { data } = await api.put<ReviewKycResponse>(API_ENDPOINTS.ADMIN_KYC_REVIEW_ACTION, body);
  return data;
}

/**
 * Approve / reject a single document via `document-action` (PUT). The backend keys
 * on `kyc_id` and a lowercase action; no reason is sent at the document level.
 */
export async function reviewKycDocument(kycId: number, action: "APPROVE" | "REJECT"): Promise<ReviewKycResponse> {
  const { data } = await api.put<ReviewKycResponse>(API_ENDPOINTS.ADMIN_KYC_DOC_ACTION, {
    kyc_id: kycId,
    action: action.toLowerCase(),
  });
  return data;
}

/* ----- Role Switch Review ----- */

/** Map one raw `users/switched-roles` row to a RoleSwitchRequest. */
function toRoleSwitchRequest(raw: Record<string, unknown>): RoleSwitchRequest {
  const first = (raw.first_name as string | null) ?? "";
  const last = (raw.last_name as string | null) ?? "";
  const email = String(raw.company_email ?? "");
  const name = [first, last].filter(Boolean).join(" ").trim() || (raw.company_name as string) || email || "—";

  return {
    companyUserRoleId: Number(raw.company_user_role_id),
    userId: String(raw.user_id ?? ""),
    companyId: raw.company_id != null ? String(raw.company_id) : undefined,
    userName: name,
    email,
    companyName: (raw.company_name as string | undefined) ?? undefined,
    photoKey: (raw.profile_photo as string | null) ?? null,
    roleId: Number(raw.role_id),
    roleCode: String(raw.role_code ?? ""),
    roleName: (raw.role_name as string | undefined) ?? undefined,
    isDefaultRole: raw.is_default_role === true,
    status: toReviewStatus(raw.status),
    isProfileCompleted: raw.is_profile_completed === true,
    rejectionReason: (raw.rejection_reason as string | null) ?? null,
    switchedAt: (raw.switched_at as string | null) ?? null,
    approvedAt: (raw.approved_at as string | null) ?? null,
  };
}

/**
 * Every role held by users with more than one — the review queue for added roles.
 * The backend returns one row per role in a single call, so filtering by status
 * happens client-side (same as the KYC Review list).
 */
export async function fetchSwitchedRoleUsers(): Promise<RoleSwitchRequest[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN_SWITCHED_ROLES);
  const rows = ((data?.data ?? data) as Record<string, unknown>[]) ?? [];
  return Array.isArray(rows) ? rows.map(toRoleSwitchRequest) : [];
}

/**
 * The profile behind one role-switch request — what the user filled in for the role
 * they're asking for. Same `ProfileField[]` shape as the user's own profile (the
 * backend resolves the same field config for the target user + reviewed role), so the
 * drawer renders it with the value formatting My Profile already uses, and the photo
 * comes out of it via `profilePhotoKey`.
 */
export async function fetchRoleSwitchUserDetails(params: {
  userId: string;
  companyId: string;
  roleId: number;
}): Promise<ProfileField[]> {
  const { data } = await api.get<{ data?: ProfileField[] }>(API_ENDPOINTS.ADMIN_ROLE_SWITCH_DETAILS, {
    params,
  });
  return data.data ?? [];
}

/**
 * Approve or reject one added role. `rejectionReason` is required by the backend
 * when rejecting and ignored on approve. The API refuses both actions until the
 * user has completed the target role's profile.
 */
export async function reviewRoleSwitch(
  companyUserRoleId: number,
  action: "approve" | "reject",
  rejectionReason?: string
): Promise<void> {
  await api.put(API_ENDPOINTS.ADMIN_ROLE_SWITCH_ACTION, {
    companyUserRoleId,
    action,
    ...(action === "reject" ? { rejectionReason } : {}),
  });
}

/* ----- User Limit Config ----- */

/**
 * Fetch the connection limit config for a user. Returns system defaults when no
 * custom config has been saved yet (`is_custom` will be false in that case).
 * `userId` is now a UUID string.
 */
export async function fetchUserLimitConfig(userId: string): Promise<UserLimitConfig> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN_USER_LIMIT_CONFIG(userId));
  return data.data as UserLimitConfig;
}

/**
 * Create or update the connection limit config for a user (upsert). All fields are
 * optional — at least one must be provided (enforced server-side by Joi).
 * `userId` is now a UUID string.
 */
export async function updateUserLimitConfig(
  userId: string,
  payload: UpdateUserLimitConfigPayload
): Promise<UserLimitConfig> {
  const { data } = await api.put(API_ENDPOINTS.ADMIN_USER_LIMIT_CONFIG(userId), payload);
  return data.data as UserLimitConfig;
}

/* ----- Admin Accounts (Super Admin → Admin Management) ----- */

/**
 * The admin LIST endpoint is live (`GET /admin/management/admins`). The create /
 * permissions / status endpoints are still placeholders — when each real curl arrives,
 * change `ADMIN_ACCOUNT_*` in `config/constant.ts` and the raw key strings in the
 * function below it, nothing else.
 */

/** Map one raw admin row to our AdminAccount. Every field is defaulted. */
function toAdminAccount(raw: Record<string, unknown>): AdminAccount {
  const first = (raw.first_name as string | null) ?? "";
  const last = (raw.last_name as string | null) ?? "";
  const email = String(raw.email ?? raw.admin_email ?? "");
  const name = String(raw.name ?? [first, last].filter(Boolean).join(" ").trim()) || email || "—";
  const role = normalizeRole(raw.role) === "super_admin" ? "super_admin" : "admin";
  const permsRaw = raw.permissions;

  return {
    id: String(raw.admin_id ?? raw.id ?? email),
    name,
    email,
    mobileNumber: (raw.mobile_number as string | undefined) ?? undefined,
    countryCode: (raw.country_code as string | null) ?? null,
    role,
    roleProfile: (raw.role_profile as string | undefined) ?? undefined,
    permissions: Array.isArray(permsRaw) ? permsRaw.map(String) : [],
    /*
     * Same rule as the user list above: `is_admin_suspended` is the column the suspend /
     * activate endpoints write and the flag adminMiddleware blocks on. The endpoint returns
     * raw Admin rows (`attributes: { exclude: ['password'] }`), so there is no derived
     * `status` string — reading one always yielded "ACTIVE". The string form is still
     * accepted first in case the endpoint starts sending it.
     */
    status:
      String(raw.status ?? "").toUpperCase() === "SUSPENDED" || raw.is_admin_suspended === true
        ? "SUSPENDED"
        : "ACTIVE",
    createdAt: (raw.created_at as string | undefined) ?? undefined,
    lastLoginAt: (raw.last_login_at as string | undefined) ?? undefined,
    createdBy: (raw.created_by as string | undefined) ?? undefined,
    isDeleted: raw.is_deleted === true,
  };
}

/**
 * The backend's `limit` defaults to 10 and is capped at 100. The page filters and pages
 * client-side, so we ask for the maximum in one call — without this the table would
 * silently show only the first 10 accounts.
 *
 * TODO: past 100 staff accounts this must move to server-side paging/search (the endpoint
 * already accepts `page`, `status` and `search`).
 */
const ADMIN_LIST_LIMIT = 100;

/** Fetch every staff account. Filtering + paging happen client-side in the page. */
export async function fetchAdmins(): Promise<AdminAccount[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN_ACCOUNTS, {
    params: { page: 1, limit: ADMIN_LIST_LIMIT },
  });
  // { success, message, data: { admins: [...], pagination: {...} } }
  const rows = data?.data?.admins ?? data?.admins ?? data?.data ?? data;
  if (!Array.isArray(rows)) return [];
  return (rows as Record<string, unknown>[])
    .filter((row) => row.is_deleted !== true)
    .map(toAdminAccount);
}

/**
 * One staff account with its permission matrix and audit trail.
 * Response: { data: { admin, permissions[], activityLogs[] } }.
 *
 * The list endpoint returns neither permissions nor logs, so the drawer fetches this on
 * open rather than reusing the row it was opened from.
 */
export async function fetchAdminDetail(id: string): Promise<AdminDetail> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN_ACCOUNT(id));
  const payload = (data?.data ?? data ?? {}) as Record<string, unknown>;
  const rawAdmin = (payload.admin ?? payload) as Record<string, unknown>;
  const rawPerms = Array.isArray(payload.permissions) ? payload.permissions : [];
  const rawLogs = Array.isArray(payload.activityLogs) ? payload.activityLogs : [];

  const permissions: AdminPermission[] = (rawPerms as Record<string, unknown>[]).map((p) => ({
    id: String(p.id ?? p.permission_key ?? ""),
    permissionKey: String(p.permission_key ?? ""),
    isAllowed: p.is_allowed !== false,
  }));

  return {
    // Fold the granted keys onto the account so the drawer's existing permission chips
    // and the permissions editor keep working off `AdminAccount.permissions`.
    admin: {
      ...toAdminAccount(rawAdmin),
      permissions: permissions.filter((p) => p.isAllowed).map((p) => p.permissionKey),
    },
    permissions,
    activityLogs: (rawLogs as Record<string, unknown>[]).map((log) => {
      const by = (log.performedByAdmin ?? log.performed_by_admin) as
        | Record<string, unknown>
        | undefined;
      return {
        id: String(log.id ?? ""),
        action: String(log.action ?? ""),
        reason: (log.reason as string | null) ?? undefined,
        createdAt: (log.created_at as string | undefined) ?? undefined,
        adminId: (log.admin_id as string | undefined) ?? undefined,
        metadata:
          log.metadata && typeof log.metadata === "object"
            ? (log.metadata as Record<string, unknown>)
            : undefined,
        performedBy: by
          ? {
              id: (by.id as string | undefined) ?? undefined,
              name: String(by.name ?? "—"),
              email: (by.email as string | undefined) ?? undefined,
              role: (by.role as string | undefined) ?? undefined,
            }
          : undefined,
      };
    }),
  };
}

/**
 * Create a staff account from the "Create New Admin" form.
 *
 * The endpoint's Joi schema is strict — unknown keys are rejected with a 400, `role` must
 * be exactly "ADMIN", and every `permission_key` must be in the backend's
 * ADMIN_PERMISSION_KEYS enum. So the body is built explicitly rather than spread, and
 * `sendWelcomeEmail` is deliberately not sent.
 *
 * Response: { data: { …admin } } — the account itself, not wrapped in `admin`.
 */
export async function createAdmin(payload: CreateAdminPayload): Promise<AdminAccount> {
  const { data } = await api.post(API_ENDPOINTS.ADMIN_ACCOUNTS, {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    country_code: payload.countryCode,
    mobile_number: payload.mobileNumber,
    // The form only ever creates ADMINs; the schema accepts no other value.
    role: "ADMIN",
    permissions: payload.permissions.map((p) => ({
      permission_key: p.permissionKey,
      is_allowed: p.isAllowed,
    })),
  });
  return toAdminAccount((data?.data ?? data ?? {}) as Record<string, unknown>);
}

/**
 * Update an existing admin's profile fields and/or permission matrix in one PUT.
 *
 * Only keys the caller actually set are sent: the schema is strict (unknown keys 400) and
 * requires at least one of name / country_code / mobile_number / permissions.
 * Response: { data: { …admin } }.
 */
export async function updateAdmin(id: string, payload: UpdateAdminPayload): Promise<AdminAccount> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.countryCode !== undefined) body.country_code = payload.countryCode;
  if (payload.mobileNumber !== undefined) body.mobile_number = payload.mobileNumber;
  if (payload.permissions) {
    body.permissions = payload.permissions.map((p) => ({
      permission_key: p.permissionKey,
      is_allowed: p.isAllowed,
    }));
  }

  const { data } = await api.put(API_ENDPOINTS.ADMIN_ACCOUNT(id), body);
  return toAdminAccount((data?.data ?? data ?? {}) as Record<string, unknown>);
}

/**
 * Soft-delete an admin. Like suspend/activate this REQUIRES a `reason` (5–500 chars),
 * which DELETE carries in a body — hence axios's `data` option. Returns no body.
 */
export async function deleteAdmin(id: string, reason: string): Promise<void> {
  await api.delete(API_ENDPOINTS.ADMIN_ACCOUNT(id), { data: { reason } });
}

/**
 * Suspend or reactivate an admin — two separate PATCH endpoints, not a status field.
 * `reason` is REQUIRED by both (5–500 chars) and is collected by the confirm modal.
 * Neither returns a body, so the caller patches the row locally.
 */
export async function setAdminStatus(
  id: string,
  status: AdminAccountStatus,
  reason: string
): Promise<void> {
  const url =
    status === "SUSPENDED"
      ? API_ENDPOINTS.ADMIN_ACCOUNT_SUSPEND(id)
      : API_ENDPOINTS.ADMIN_ACCOUNT_ACTIVATE(id);
  await api.patch(url, { reason });
}

export async function fetchMatchingEngineStats(): Promise<MatchingEngineStats> {
  const { data } = await api.get<{ success: boolean; data: MatchingEngineStats; message: string }>(
    API_ENDPOINTS.ADMIN_MATCHING_ENGINE_STATS,
  );
  return data.data;
}
