"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { initials } from "@/lib/admin-format";
import { SUPPORT } from "@/lib/messages";
import { isStaffRole, normalizeRole } from "@/lib/roles";
import { getSuspension, type SuspensionDetails } from "@/lib/suspension";

/**
 * Where a suspended user or admin lands (`/account-suspended`, see `lib/suspension.ts`).
 *
 * The account is blocked, so this is a dead end by design: who was suspended, why, what to do
 * next, and the support address. There is no way back into the app from here.
 *
 * The reason is API-supplied — it comes from the backend's suspension 403, captured by the
 * axios interceptor. There is deliberately **no fetch on this page**: that same 403 clears the
 * auth cookies server-side, so any call made from here would just 401. Only NEXT_STEPS and
 * `SUPPORT.EMAIL` are hard-coded copy.
 *
 * The whole card is sized to fit one screen without scrolling: it's a single message, and a
 * blocked user shouldn't have to scroll to find the address they need. Anything added here has
 * to earn its height — keep the type scale and the gaps as tight as they are.
 */

/** The three things a suspended account can actually do, in order. */
const NEXT_STEPS: { title: string; body: string }[] = [
  {
    title: "Check your registered email",
    body: "Any suspension notice was sent there, usually naming the policy or document at issue.",
  },
  {
    title: "Gather what was asked for",
    body: "Corrected KYC documents, updated company details, or a written clarification.",
  },
  {
    title: "Request a review",
    body: "Email support from your registered address and the team will re-check the account.",
  },
];

export default function AccountSuspendedPage() {
  const [account, setAccount] = useState<SuspensionDetails | null>(null);
  /** sessionStorage is browser-only, so the first paint has nothing to render. */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only; runs once on mount */
    setAccount(getSuspension());
    setLoaded(true);
  }, []);

  const role = normalizeRole(account?.role);
  const isStaff = account?.scope === "admin" || isStaffRole(role);
  const signInPath = !isStaff
    ? "/login"
    : role === "super_admin"
      ? "/superadmin/login"
      : "/admin/login";

  // Pre-fill the appeal so support gets an identifiable mail instead of a blank one.
  const mailSubject = encodeURIComponent("Suspended account — review request");
  const mailBody = encodeURIComponent(
    [
      "Hello Support team,",
      "",
      "My account has been suspended and I'd like to request a review.",
      "",
      `Name: ${account?.name ?? ""}`,
      `Registered email: ${account?.email ?? ""}`,
      "",
      "Details:",
      "",
    ].join("\n"),
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col justify-center px-4 py-6 sm:px-6">
      <Card padding="none" className="p-6">
        {loaded && (
          <div className="flex flex-col gap-5">
            {/* 1 — What happened */}
            <header className="flex flex-col items-center gap-2 text-center">
              {/* Kept small on purpose — the tile and the gap under it are the only slack
                    left before this card starts scrolling. */}
              <span className="flex size-10 items-center justify-center rounded-2xl bg-error-container/40 text-error">
                <Icon name="block" size={24} />
              </span>
              <div className="space-y-1">
                <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                  Account suspended
                </h1>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  Access has been paused for this account. Signing in again won&apos;t restore it —
                  it has to be reviewed by our team first.
                </p>
              </div>
            </header>

            {/* 2 — Whose account */}
            {(account?.name || account?.email) && (
              <section className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                  {initials(account?.name)}
                </div>
                <div className="min-w-0">
                  {account?.name && (
                    <p className="truncate text-sm font-bold text-on-surface">{account?.name}</p>
                  )}
                  {account?.email && (
                    <p className="truncate text-xs text-on-surface-variant">{account?.email}</p>
                  )}
                </div>
              </section>
            )}

            {/* 3 — Why */}
            <section className="space-y-1.5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                <Icon name="gavel" size={16} />
                Reason for suspension
              </h2>
              <p className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm leading-relaxed text-on-surface">
                {account?.reason ?? (
                  <span className="text-on-surface-variant">
                    No reason was recorded on the account. Contact support and the reviewing team
                    will share the details.
                  </span>
                )}
              </p>
            </section>

            {/* 4 — What to do next (copy, not account data) */}
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                <Icon name="checklist" size={16} />
                What to do next
              </h2>
              <ol className="space-y-2">
                {NEXT_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[11px] font-bold text-on-surface-variant">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface">{step.title}</p>
                      <p className="text-[11px] leading-relaxed text-on-surface-variant">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* 5 — Contact: the address and nothing else. */}
            <section className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm">
              <Icon name="mail" size={18} className="text-on-surface-variant" />
              <span className="text-on-surface-variant">Contact support at</span>
              <a
                href={`mailto:${SUPPORT.EMAIL}?subject=${mailSubject}&body=${mailBody}`}
                className="font-semibold text-primary underline underline-offset-2"
              >
                {SUPPORT.EMAIL}
              </a>
            </section>

            {/* Dead end: the only exit is back to sign-in. */}
            <Button
              variant="ghost"
              href={signInPath}
              leadingIcon="arrow_back"
              fullWidth
              className="h-10 text-sm"
            >
              Back to sign in
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
