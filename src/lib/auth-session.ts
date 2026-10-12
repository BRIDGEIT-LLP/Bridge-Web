/**
 * Post-auth session store — the user's role and basic profile info, kept in
 * localStorage separate from the onboarding blob. The auth tokens themselves are
 * httpOnly cookies (invisible to JS); this store holds the non-sensitive metadata
 * the backend echoes back in response bodies (role, userId, tokenType) so the UI
 * doesn't need to decode a token it can no longer read.
 */

import type { Role } from "@/lib/roles";
import { isRole } from "@/lib/roles";

const SESSION_KEY =
  process.env.NEXT_PUBLIC_SESSION_KEY ?? "bridge-platform.session";

/** Lightweight user info echoed back by the backend (all optional). */
export interface SessionUser {
  name?: string;
  email?: string;
  organizationName?: string;
}

export interface Session {
  role: Role;
  user?: SessionUser;
  /** The authenticated user's UUID, echoed back by the backend on login/verify. */
  userId?: string;
  /**
   * The access token's `type` claim (e.g. "AUTH_ACCESS_TOKEN" vs "MFA_ACCESS_TOKEN"),
   * echoed back in the response body — the token itself is an httpOnly cookie the
   * frontend can no longer read/decode, so the backend tells us this directly instead.
   */
  tokenType?: string;
}

/** Persist the current session (role + optional user info). */
export function setSession(session: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore storage quota/availability errors */
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRole(parsed?.role)) return null;
    return { role: parsed.role, user: parsed.user, userId: parsed.userId, tokenType: parsed.tokenType };
  } catch {
    return null;
  }
}

export function getRole(): Role | null {
  return getSession()?.role ?? null;
}

export function getUserId(): string | null {
  return getSession()?.userId ?? null;
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}