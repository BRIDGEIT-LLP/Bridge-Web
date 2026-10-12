"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeRole, type Role } from "@/lib/roles";
import {
  getSession,
  setSession as persistSession,
  type Session,
  type SessionUser,
} from "@/lib/auth-session";
import { switchRole as switchRoleRequest } from "@/services/auth.service";
import { clearUserProfileCache } from "@/services/user.service";
import { clearAdminProfileCache } from "@/services/admin.service";
import { clearFilePreviewCache } from "@/services/file.service";
import { logoutSession } from "@/lib/logout";
import type { SwitchRoleOutcome } from "@/types/api.types";

interface AuthContextValue {
  role: Role | null;
  user: SessionUser | undefined;
  tokenType: string | undefined;
  /** True once the persisted session has been read from localStorage. */
  isLoaded: boolean;
  /** Persist a session (e.g. right after login). */
  setSession: (session: Session) => void;
  /**
   * Switch the active role. Resolves with the outcome rather than throwing when the
   * role isn't usable yet: an added role sits at Pending until an admin approves it,
   * and that arrives as success:false at HTTP 200 (see SwitchRoleResponse).
   * First-time switches go through `/dashboard/switch-role` and
   * `POST /auth/request-role-switch` instead of this method.
   */
  switchRole: (target: Role) => Promise<SwitchRoleOutcome>;
  /**
   * Adopt a role the backend has already switched us into (an approved role
   * switch re-issues the cookie; this is the client-side half).
   */
  applyRole: (role: Role) => void;
  /** Revoke the current session on the backend, then clear local state and return to login. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSessionState] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionState(getSession());
    setIsLoaded(true);
  }, []);

  const setSession = useCallback((next: Session) => {
    persistSession(next);
    setSessionState(next);
  }, []);

  /**
   * Adopt `role` as the active one locally. The backend has already re-issued the
   * cookie by the time this runs — this is purely the client-side half, used when
   * switching into a role that an admin has already approved.
   */
  const applyRole = useCallback(
    (role: Role) => {
      // The profile is role-scoped — drop the cached copies so the next read reflects
      // the role we just switched into.
      clearUserProfileCache();
      clearAdminProfileCache();
      clearFilePreviewCache();
      // A role switch doesn't change the token type or the user's own id — only carry
      // `role` forward from the response; tokenType/userId must be preserved from the
      // current session or the dashboard guard (tokenType) and getUserId() drop to
      // undefined right after switching, breaking both until a full logout/login.
      const next: Session = {
        role,
        user: session?.user,
        tokenType: session?.tokenType,
        userId: session?.userId,
      };
      persistSession(next);
      setSessionState(next);
    },
    [session?.user, session?.tokenType, session?.userId]
  );

  const switchRole = useCallback(
    async (target: Role): Promise<SwitchRoleOutcome> => {
      // Tokens are httpOnly cookies now — the backend sets the re-issued cookie
      // directly on this response, so there's nothing for the client to store.
      const res = await switchRoleRequest({ role: target });

      // A role awaiting approval (or rejected) comes back as success:false at HTTP 200,
      // so axios resolves it. Adopting the role here would switch the UI into a role the
      // token was never re-issued for — every later request would still be the old role.
      if (res.success === false) {
        return { switched: false, status: res.data?.status, message: res.message };
      }

      applyRole(normalizeRole(res.data?.role) ?? target);
      return { switched: true, message: res.message };
    },
    [applyRole]
  );

  const logout = useCallback(async () => {
    await logoutSession(session?.role);
    setSessionState(null);
    router.push("/login");
  }, [router, session?.role]);

  const value = useMemo(
    () => ({
      role: session?.role ?? null,
      user: session?.user,
      tokenType: session?.tokenType,
      isLoaded,
      setSession,
      switchRole,
      applyRole,
      logout,
    }),
    [session, isLoaded, setSession, switchRole, applyRole, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
