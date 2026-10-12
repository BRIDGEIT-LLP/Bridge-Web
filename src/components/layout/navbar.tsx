"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/Avatar";
import { Loader } from "@/components/common/loader";
import { useAuth } from "@/components/auth/AuthProvider";
import { searchUsers } from "@/services/user.service";
import { useMyProfilePhoto } from "@/lib/useMyProfilePhoto";
import { initials } from "@/lib/admin-format";
import { ROLE_META, isUserRole, normalizeRole } from "@/lib/roles";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { connectionPresenceMeta, parseConnectionStatus } from "@/lib/connections";
import type { ApiError } from "@/lib/axios";
import type { UserSearchResult } from "@/types/api.types";

const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Navbar typeahead: debounced GET /users/search as the user types, with a
 * suggestions dropdown (outside-click / Escape to close). Picking a suggestion
 * navigates straight to that user's read-only profile page — the dropdown never
 * opens anything on its own, only on an explicit click.
 */
function NavbarSearch() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    // Debounce: only settle on a query after the user pauses typing for SEARCH_DEBOUNCE_MS.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [query]);

    // Fire the search on the settled query; abort a stale in-flight request so a
    // fast keystroke can never let an older response clobber a newer one.
    useEffect(() => {
        const trimmed = debouncedQuery.trim();
        if (trimmed.length < SEARCH_MIN_QUERY_LENGTH) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- resets state when the query is cleared/too short
            setResults([]);
            setLoading(false);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);
        searchUsers(trimmed, controller.signal)
            .then((data) => {
                setResults(data);
                setOpen(true);
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                setError((err as ApiError).message ?? "Search failed. Please try again.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [debouncedQuery]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const pick = (u: UserSearchResult) => {
        setOpen(false);
        setQuery("");
        setDebouncedQuery("");
        setResults([]);
        router.push(`/dashboard/profile/${u.user_id}?roleId=${u.role_id}&companyId=${u.company_id}`);
    };

    const showPanel = open && query.trim().length >= SEARCH_MIN_QUERY_LENGTH;

    return (
        <div ref={rootRef} className="relative w-full">
            <Input
                type="search"
                placeholder="Search"
                aria-label="Search"
                adornment={<Icon name="search" size={18} />}
                className="!rounded-full"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    if (results.length > 0) setOpen(true);
                }}
            />

            {showPanel && (
                <div className="absolute z-20 mt-2 flex max-h-80 w-full flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-lg">
                    <div className="overflow-auto p-1">
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <Loader size="small" />
                            </div>
                        ) : error ? (
                            <div className="px-3 py-2 text-sm text-error">{error}</div>
                        ) : results.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-on-surface-variant">No results</div>
                        ) : (
                            results.map((u) => {
                                const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.company_name;
                                const connectionStatus = parseConnectionStatus(u.connection_status);
                                const role = normalizeRole(u.role);
                                const roleLabel = role ? ROLE_META[role].label : u.role_name || u.role;
                                return (
                                    <button
                                        key={`${u.user_id}-${u.role_id}-${u.company_id}`}
                                        type="button"
                                        onClick={() => pick(u)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-container"
                                    >
                                        <Avatar photoKey={u.profile_photo} alt={name} className="size-8 shrink-0 rounded-full">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                                                {initials(name)}
                                            </div>
                                        </Avatar>
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-sm font-semibold text-on-surface">{name}</span>
                                            <span className="truncate text-xs text-on-surface-variant">
                                                {[roleLabel, u.company_name].filter(Boolean).join(" · ")}
                                            </span>
                                        </span>
                                        <StatusPill {...connectionPresenceMeta(connectionStatus)} />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/** The Bridge Platform glyph (no wordmark). The color is inherited (currentColor). */
export function BridgeMark({ className = "size-8 text-blue-600" }: { className?: string }) {
    return (
        <div className={`${className} shrink-0`}>
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path
                    clipRule="evenodd"
                    d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z"
                    fill="currentColor"
                    fillRule="evenodd"
                />
                <path
                    clipRule="evenodd"
                    d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z"
                    fill="currentColor"
                    fillRule="evenodd"
                />
            </svg>
        </div>
    );
}

/** Bridge Platform logo lockup (glyph + wordmark), shared by the navbar and sidebar. */
export function BrandLockup({ className = "", showLabel = true }: { className?: string; showLabel?: boolean }) {
    return (
        <span className={`flex items-center gap-3 ${className}`}>
            <BridgeMark />
            <span
                className={`overflow-hidden whitespace-nowrap font-bold text-2xl tracking-tight transition-[max-width,opacity] duration-200 ${
                    showLabel ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0"
                }`}
            >
                Bridge Platform
            </span>
        </span>
    );
}

/**
 * The signed-in identity (avatar + name + role label), shown in the dashboard navbar
 * for every role — user, admin and super_admin alike. Renders nothing until the auth
 * role resolves, so it never flashes a placeholder identity on first paint.
 */
function NavbarProfile() {
    const { role, user } = useAuth();
    // Only the three user roles have a `/users/profile` record — staff would just 404.
    const photoKey = useMyProfilePhoto(isUserRole(role));

    if (!role) return null;

    const meta = ROLE_META[role];
    const name = user?.name || user?.email || meta.label;

    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar photoKey={photoKey} alt={name} className="size-9 shrink-0 rounded-full">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    <Icon name={meta.icon} size={20} />
                </div>
            </Avatar>
            <div className="hidden min-w-0 max-w-[160px] md:block">
                <p className="truncate text-sm font-bold text-on-surface">{name}</p>
                <p className="truncate text-xs text-on-surface-variant">{meta.label}</p>
            </div>
        </div>
    );
}

/**
 * Dashboard variant of the navbar. Rendered inside the dashboard content column
 * (to the right of the sidebar), so it starts where the sidebar ends. It omits the
 * brand lockup (the sidebar already shows it) and carries the notifications control
 * followed by the signed-in identity.
 */
export function DashboardNavbar({ onMenuClick }: { onMenuClick?: () => void }) {
    return (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-outline-variant/30 bg-surface-container-lowest px-3 sm:px-4 lg:grid lg:grid-cols-[1fr_3fr_1fr] lg:px-6">
            <div className="flex shrink-0 items-center">
                <button
                    type="button"
                    onClick={onMenuClick}
                    aria-label="Open navigation menu"
                    className="flex size-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface lg:hidden"
                >
                    <Icon name="menu" size={24} />
                </button>
            </div>
            <div className="min-w-0 flex-1 lg:w-full lg:justify-self-center">
                <NavbarSearch />
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-1 justify-self-end sm:gap-2">
                <button
                    type="button"
                    aria-label="Notifications"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
                >
                    <Icon name="notifications" size={22} />
                </button>
                <NavbarProfile />
            </div>
        </header>
    );
}

export function Navbar() {
    const pathname = usePathname();
    // The dashboard owns its own chrome (sidebar + DashboardNavbar), and the
    // marketing landing page renders its own header, so hide the global navbar on them.
    if (pathname === "/landing-page" || pathname?.startsWith("/dashboard")) return null;

    return (
        <nav className="flex-none flex items-center justify-between px-4 py-2 w-full max-w-[1200px] mx-auto sm:px-6">
            <Link href="/" aria-label="Bridge Platform home">
                <BrandLockup />
            </Link>
        </nav>
    );
}
