/**
 * Suspended-account detection + handoff to `/account-suspended`.
 *
 * There are **two** independent suspension checks on the backend, one per audience, and
 * each announces itself with its own flag:
 *
 *   `middleware/authMiddleware.js`  (platform users: startup / investor / b2b_enterprise)
 *     403 { success: false,
 *           message: "Your account has been suspended. Please contact support.",
 *           data: { is_user_suspended: true, reason: string | null } }
 *
 *   `middleware/adminMiddleware.js` (staff console)
 *     403 { success: false,
 *           message: "Your account has been suspended. Please contact support.",
 *           data: { is_admin_suspended: true, reason: string | null } }
 *
 * They differ in one way that matters here: the **user** 403 also clears the auth cookies
 * and suspending revokes every session server-side, so an open tab is cut off on its very
 * next call. The **admin** 403 leaves the cookies in place and just blocks every request —
 * so the frontend is what actually ends the admin's session (`clearSession()` in the axios
 * interceptor). Either way the account is done: both land on the same dead-end screen.
 *
 * Because the user 403's cookies are gone by the time we redirect, that response body is the
 * *only* chance to learn the reason — a follow-up authenticated GET would just 401. So the
 * interceptor stashes what the API said (plus the name/email/role the session already held)
 * and `/account-suspended` renders it.
 *
 * The stash lives in **sessionStorage**: it's a one-screen handoff, and logout wipes
 * localStorage entirely (see AuthProvider), which would blank the page.
 */

const STORAGE_KEY = "bridge-platform.suspension";

/** Where a suspended account is sent. */
export const SUSPENDED_ROUTE = "/account-suspended";

/** Which of the two backend checks blocked the request — i.e. which console the account
 *  belongs to. Drives where "Back to sign in" points, without having to trust that the
 *  dying local session still had a readable role on it. */
export type SuspensionScope = "user" | "admin";

/** What the suspension screen shows. Only `scope`/`reason`/`message` come from the 403 itself. */
export interface SuspensionDetails {
  /** "admin" when `is_admin_suspended` blocked the request, "user" for `is_user_suspended`. */
  scope?: SuspensionScope;
  /** The backend's own message ("Your account has been suspended…"). */
  message?: string;
  /** Why it was suspended — `suspension_reason` from the admin who suspended the account. */
  reason?: string;
  /** Who it was, carried over from the session that just got cut off. */
  name?: string;
  email?: string;
  /** Raw backend role, shown as a chip. */
  role?: string;
}

/** Narrow an unknown payload to an indexable object without `any`. */
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Trimmed string, or undefined for anything else (the backend sends `reason: null`). */
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * Is this error response a suspension block, and if so what did it say?
 * Returns `null` for anything else (an ordinary permissions failure must NOT redirect).
 *
 * Detection is the explicit `is_user_suspended` / `is_admin_suspended` flags ONLY. Never
 * match on the message text: this path logs the account out and strands it on a dead-end
 * screen, so an unrelated 403 that happens to say "suspended" (a feature paused for
 * maintenance, say) would sign out a healthy account. A new endpoint that blocks a suspended
 * account must send one of the flags.
 *
 * The flag — not the status code — is the contract. 403 is what both middlewares send today,
 * but 401 is accepted too: if that ever drifts, the frontend must not silently degrade to a
 * generic "session expired" toast that hides why the account was actually cut off.
 */
export function parseSuspension(status: number | undefined, data: unknown): SuspensionDetails | null {
  if (status !== 403 && status !== 401) return null;

  const body = asRecord(data);
  const inner = asRecord(body.data);

  // Both nesting levels, because responses vary in whether they wrap the payload in `data`.
  const flagged = (key: string) => inner[key] === true || body[key] === true;

  // Admin is checked first only so a (hypothetical) response carrying both flags resolves to
  // the more specific console; the two are mutually exclusive in practice — a request passes
  // through either authMiddleware or adminMiddleware, never both.
  const scope: SuspensionScope | null = flagged("is_admin_suspended")
    ? "admin"
    : flagged("is_user_suspended")
      ? "user"
      : null;

  if (!scope) return null;

  return {
    scope,
    message: str(body.message),
    reason: str(inner.reason) ?? str(body.reason),
  };
}

export function setSuspension(details: SuspensionDetails) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch {
    /* ignore storage quota/availability errors — the page has fallback copy */
  }
}

export function getSuspension(): SuspensionDetails | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SuspensionDetails) : null;
  } catch {
    return null;
  }
}

export function clearSuspension() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
