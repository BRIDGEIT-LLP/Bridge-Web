"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { VouchWidgetData } from "@/types/dashboard";

/**
 * S10 "Vouch for someone" widget. FRD §3.7 calls this "Referral" and only
 * specifies a code + redemption + one free month on the referee's first
 * payment — no Vouch/Referral model exists in Bridge-Server yet, so the code
 * shown here is the dummy value the backend returns rather than a real one.
 * Matches the design's CTA-only card; clicking the button reveals the code
 * inline (no dedicated Vouch page exists yet to link out to).
 */
export function VouchWidget({ vouch }: { vouch: VouchWidgetData }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(vouch.vouchCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure context) — no-op.
    }
  };

  return (
    <Card surface="lowest" padding="md">
      <h2 className="font-headline text-base font-bold text-on-surface sm:text-lg">
        Vouch for someone
      </h2>
      <p className="mt-1.5 text-xs text-on-surface-variant sm:text-sm">
        Know an owner, founder or investor who belongs here? Put your name on
        them. When they become a member, you get a month free.
      </p>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-3 flex items-center gap-2 rounded-lg border border-outline-variant/50 px-3 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container sm:text-sm"
        >
          <Icon name="redeem" size={16} />
          Get your vouch code
        </button>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-surface-container px-3 py-2.5">
          <span className="truncate font-mono text-sm font-bold tracking-wide text-on-surface">
            {vouch.vouchCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Icon name={copied ? "check" : "content_copy"} size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </Card>
  );
}
