/**
 * The access token is an httpOnly cookie now (see the auth cookie migration) — it's
 * never exposed to page JS, so it can no longer be decoded here. `getCurrentUserId`
 * is kept as a thin re-export over `auth-session.ts`'s `getUserId()` (the backend
 * echoes `userId` in the login/verify response body, stored there) purely so the
 * many existing call sites across the deal-room feature don't all need to change
 * their import path/name — only this file's internals changed.
 */

import { getUserId } from "@/lib/auth-session";

/** The current user's UUID, or null if unavailable. */
export function getCurrentUserId(): string | null {
  return getUserId();
}