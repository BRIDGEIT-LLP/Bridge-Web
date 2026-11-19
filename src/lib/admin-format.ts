/**
 * Shared display helpers for the admin back-office screens (User Management +
 * KYC Review) — keeps the pages and their drawers from duplicating the same
 * formatting. Pure functions only; no UI here.
 */

import { ROLE_META, normalizeRole } from "@/lib/roles";

/** Up-to-2-letter initials from a name, for the inline avatar circle. */
export function initials(name?: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Friendly role label from a raw backend role string (falls back to the raw value). */
export function roleLabel(raw?: string): string {
  if (!raw) return "—";
  const role = normalizeRole(raw);
  return role ? ROLE_META[role].label : raw;
}

/**
 * Short date in day-month-year order (e.g. "12 Oct 2023"), matching the design.
 * Locale is pinned to en-GB rather than left to the browser — with `undefined`,
 * an en-US browser renders "Oct 12, 2023" regardless of the `{day, month, year}`
 * option order, since locale convention (not object order) decides component
 * order. Empty input → em dash.
 */
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Same as `formatDate` plus a 24-hour time (e.g. "12 Oct 2023, 09:51"); empty input → em dash. */
export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time}`;
}

/** Relative "x ago" for last-active style timestamps; empty input → em dash. */
export function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  if (mins < 43200) return `${Math.round(mins / 1440)}d ago`;
  return formatDate(iso);
}
