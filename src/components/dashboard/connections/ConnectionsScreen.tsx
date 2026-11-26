"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal/Modal";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/common/loader";
import { ConnectionsList } from "@/components/dashboard/connections/ConnectionsList";
import { ConnectionDetailDrawer } from "@/components/dashboard/connections/ConnectionDetailDrawer";
import { DECLINE_REASONS, DEFAULT_DECLINE_REASON, tabFor, type ConnectionTab } from "@/lib/connections";
import type { ConnectionRequest, ConnectionStatus } from "@/types/api.types";

const TABS: { key: ConnectionTab; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "sent", label: "Sent" },
  { key: "history", label: "History" },
];

interface ConnectionsScreenProps {
  /** Every request, both directions — the screen splits them into tabs. */
  requests: ConnectionRequest[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Perform an action by setting the new status; resolves on success, throws on failure. */
  onAction: (id: string, status: ConnectionStatus, reason?: string) => Promise<void>;
  /** Silent read-receipt: mark a received, pending request as Viewed when opened. */
  onView?: (id: string) => void | Promise<void>;
}

/**
 * The whole Connections screen UI — Received / Sent / History tabs, a card per request
 * with inline Accept / Decline / Withdraw, and the detail drawer. Data-source agnostic:
 * both the live page and the demo page render this and only differ in how they load
 * data / run actions.
 */
export function ConnectionsScreen({ requests, loading, error, onRetry, onAction, onView }: ConnectionsScreenProps) {
  const [tab, setTab] = useState<ConnectionTab>("received");
  const [selected, setSelected] = useState<ConnectionRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<ConnectionRequest | null>(null);
  const [reason, setReason] = useState<string>(DEFAULT_DECLINE_REASON);
  const [otherNote, setOtherNote] = useState("");
  const [withdrawing, setWithdrawing] = useState<ConnectionRequest | null>(null);

  const grouped = useMemo(() => {
    const g: Record<ConnectionTab, ConnectionRequest[]> = { received: [], sent: [], history: [] };
    for (const r of requests) g[tabFor(r)].push(r);
    g.history.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return g;
  }, [requests]);

  // Open the detail drawer; if it's a received, still-pending request, mark it Viewed
  // (read receipt) via the change-status API — optimistically in the drawer too.
  const openRequest = (r: ConnectionRequest) => {
    if (r.direction === "received" && r.status === "PENDING") {
      setSelected({ ...r, status: "VIEWED" });
      void onView?.(r.id);
    } else {
      setSelected(r);
    }
  };

  // Drawer action: close on success; errors keep it open (page toasts).
  const handleDrawerAction = async (id: string, status: ConnectionStatus, why?: string) => {
    await onAction(id, status, why);
    setSelected(null);
  };

  // Inline action: track busy state; errors are already toasted by the page.
  const runInline = async (id: string, status: ConnectionStatus, why?: string): Promise<boolean> => {
    setBusyId(id);
    try {
      await onAction(id, status, why);
      return true;
    } catch {
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const closeDecline = () => {
    setDeclining(null);
    setReason(DEFAULT_DECLINE_REASON);
    setOtherNote("");
  };

  const confirmDecline = async () => {
    if (!declining) return;
    const finalReason = reason === "Other" && otherNote.trim() ? otherNote.trim() : reason;
    if (await runInline(declining.id, "DECLINED", finalReason)) closeDecline();
  };

  const confirmWithdraw = async () => {
    if (!withdrawing) return;
    if (await runInline(withdrawing.id, "WITHDRAWN")) setWithdrawing(null);
  };

  const busy = busyId !== null;
  const firstName = declining?.name.split(" ")[0] ?? "";

  return (
    <div className="flex w-full max-w-[1180px] flex-col px-4 pb-10 pt-4 sm:px-8 sm:pt-5">
      {/* Page title (prototype topbar h1: 19px / 700) */}
      <h1 className="mb-[22px] font-headline text-[19px] font-bold tracking-[-0.01em] text-[#1A1F2B]">Requests</h1>

      {/* Tabs — prototype `.tabs` */}
      <div
        role="tablist"
        className="no-scrollbar mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[#E3E8EE]"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-[#5B6472] hover:text-[#1A1F2B]"
              }`}
            >
              {t.label}
              <span className="rounded-full border border-[#E3E8EE] bg-[#F6F8FA] px-1.5 text-[11px] font-normal leading-normal text-[#5B6472]">
                {loading ? "–" : grouped[t.key].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <ConnectionsList
        requests={grouped[tab]}
        tab={tab}
        onSelect={openRequest}
        onAccept={(r) => void runInline(r.id, "ACCEPTED")}
        onDecline={setDeclining}
        onWithdraw={setWithdrawing}
        busyId={busyId}
        loading={loading}
        error={error}
        onRetry={onRetry}
      />

      {/* Detail + actions */}
      <ConnectionDetailDrawer request={selected} onClose={() => setSelected(null)} onAction={handleDrawerAction} />

      {/* Decline — pick a reason (prototype's decline dialog) */}
      <Modal
        open={declining !== null}
        onClose={closeDecline}
        closeDisabled={busy}
        title={declining ? `Decline ${firstName}’s request?` : "Decline request"}
        maxWidthClass="max-w-[520px]"
        footer={
          <>
            <button
              type="button"
              onClick={closeDecline}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#CFD6DF] bg-white px-4 text-[13.5px] font-semibold text-primary transition-colors hover:border-primary hover:bg-[#EAF1FC] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDecline}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#9F403D] px-4 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader size={16} />}
              Decline
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[#5B6472]">
            {firstName} won’t see your reason. It helps us make better introductions for both of you.
          </p>
          <div role="radiogroup" className="flex flex-col gap-2">
            {DECLINE_REASONS.map((r) => {
              const checked = reason === r;
              return (
                <label
                  key={r}
                  className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border bg-white p-3 transition-colors hover:border-[#B4BDC9] hover:bg-[#F6F8FA] ${
                    checked ? "border-[1.5px] border-primary !bg-[#EAF1FC] p-[11.5px]" : "border-[#CFD6DF]"
                  }`}
                >
                  <input
                    type="radio"
                    name="decline-reason"
                    value={r}
                    checked={checked}
                    onChange={() => setReason(r)}
                    className="pointer-events-none absolute opacity-0"
                  />
                  <strong className={`text-[13px] font-semibold ${checked ? "text-primary" : "text-[#1A1F2B]"}`}>{r}</strong>
                </label>
              );
            })}
          </div>
          {reason === "Other" && (
            <Input
              label="Tell us more"
              placeholder="Optional"
              value={otherNote}
              onChange={(e) => setOtherNote(e.target.value)}
            />
          )}
        </div>
      </Modal>

      {/* Withdraw — confirm */}
      <Modal
        open={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        closeDisabled={busy}
        title="Withdraw this request?"
        maxWidthClass="max-w-[520px]"
        footer={
          <>
            <button
              type="button"
              onClick={() => setWithdrawing(null)}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#CFD6DF] bg-white px-4 text-[13.5px] font-semibold text-primary transition-colors hover:border-primary hover:bg-[#EAF1FC] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmWithdraw}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#9F403D] px-4 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader size={16} />}
              Withdraw
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[#5B6472]">
          {withdrawing ? `Your request to ${withdrawing.name} will be withdrawn.` : ""}
        </p>
      </Modal>
    </div>
  );
}
