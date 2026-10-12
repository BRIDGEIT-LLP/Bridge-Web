"use client";

/**
 * Sender identity for the Proposal Form Modal — the CURRENT user's name, company
 * and role, prepopulated (read-only) into the modal AND sent in the payload.
 *
 * Sourced entirely from `GET /api/v1/users/profile` (the same API the Profile page
 * uses), NOT from the auth session — the session doesn't carry the company name.
 */

import { useEffect, useState } from "react";
import { getUserProfile, type ProfileField } from "@/services/user.service";
import { normalizeRole, type Role } from "@/lib/roles";
import { useAuth } from "@/components/auth/AuthProvider";

export interface SenderIdentity {
  name: string;
  company: string;
  role: Role | null;
}

/** Pull a single string value out of the profile field list by column name. */
function fieldValue(fields: ProfileField[], col: string): string {
  const f = fields.find((x) => x.columnName === col);
  if (!f) return "";
  return typeof f.value === "string" ? f.value : Array.isArray(f.value) ? f.value.join(", ") : "";
}

/** Derive the sender identity from a profile-fields response. */
export function deriveSenderIdentity(fields: ProfileField[]): SenderIdentity {
  const name = [fieldValue(fields, "first_name"), fieldValue(fields, "last_name")]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    name,
    company: fieldValue(fields, "organization_name"),
    role: normalizeRole(fieldValue(fields, "role")),
  };
}

/**
 * Fetch the current user's profile and expose the derived identity.
 *
 * Name + company come from `GET /users/profile`; the **role** comes from the auth
 * session (`useAuth`) — it's the already-normalized `Role` that drives the whole
 * dashboard, and it reliably maps to the intent-option lists (the profile API's
 * raw `role` value doesn't always normalize).
 *
 * Pass `enabled` (i.e. "is the proposal modal open?") so the request is deferred
 * until the identity is actually needed — mounting Explore no longer costs a profile
 * fetch, and `getUserProfile` is module-cached, so reopening the modal is free.
 */
export function useSenderIdentity(enabled = true): { sender: SenderIdentity; loading: boolean } {
  const { role } = useAuth();
  const [profile, setProfile] = useState<{ name: string; company: string }>({ name: "", company: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getUserProfile()
      .then((res) => {
        if (!active) return;
        const derived = deriveSenderIdentity(res.data ?? []);
        setProfile({ name: derived.name, company: derived.company });
      })
      .catch(() => {
        /* leave empty name/company; modal shows a graceful fallback */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { sender: { name: profile.name, company: profile.company, role: role ?? null }, loading };
}
