"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { WeightRow } from "@/components/dashboard/suggestion-weights/WeightRow";
import { useAuth } from "@/components/auth/AuthProvider";
import { isStaffRole } from "@/lib/roles";

interface Parameter {
  key: string;
  label: string;
  description: string;
  icon: string;
  defaultWeight: number;
}

const PARAMETERS: Parameter[] = [
  { key: "sector",       label: "Sector / Industry",     description: "Shared sector overlap",                icon: "category",             defaultWeight: 25 },
  { key: "stage",        label: "Investment Stage",       description: "Startup stage vs. investor preference", icon: "stacked_bar_chart",    defaultWeight: 20 },
  { key: "ticket",       label: "Ticket Size Fit",        description: "Funding ask vs. investor range",        icon: "payments",             defaultWeight: 18 },
  { key: "revenue",      label: "Revenue Range",          description: "B2B buyer / seller compatibility",      icon: "trending_up",          defaultWeight: 15 },
  { key: "geo",          label: "Geographic Proximity",   description: "City / country / region bonus",         icon: "location_on",          defaultWeight: 10 },
  { key: "completeness", label: "Profile Completeness",   description: "Richer profiles rank higher",           icon: "assignment_turned_in", defaultWeight: 7  },
  { key: "recency",      label: "Activity Recency",       description: "Recent login / engagement bonus",       icon: "schedule",             defaultWeight: 3  },
  { key: "connection",   label: "Connection Degree",      description: "Mutual connections / warm intro",       icon: "hub",                  defaultWeight: 2  },
];

const DEFAULT_WEIGHTS: Record<string, number> = Object.fromEntries(
  PARAMETERS.map((p) => [p.key, p.defaultWeight])
);

export default function SuggestionWeightsPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && !isStaffRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);

  const handleChange = useCallback((key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
    toast.info("Reset to default weights.");
  };

  const handleSave = async () => {
    if (total !== 100) return;
    setSaving(true);
    try {
      // TODO: replace with real API call when endpoint is ready
      await new Promise((r) => setTimeout(r, 600));
      setSavedAt(new Date());
      toast.success("Weights saved successfully.");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const totalState = total === 100 ? "valid" : total > 100 ? "over" : "under";

  const totalColorClass =
    totalState === "valid" ? "text-green-600" :
    totalState === "over"  ? "text-error"     :
                             "text-amber-500";

  const barColorClass =
    totalState === "valid" ? "bg-green-500" :
    totalState === "over"  ? "bg-error"     :
                             "bg-amber-400";

  if (!isLoaded || !isStaffRole(role)) return null;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 md:p-8">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
            Suggestion Weights
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Configure how each parameter influences the profile suggestion score. Weights must total 100.
          </p>
        </div>
        {savedAt && (
          <span className="flex items-center gap-1.5 rounded-lg bg-surface-container-low px-3 py-1.5 text-xs text-on-surface-variant">
            <Icon name="check_circle" size={14} className="text-green-600" filled />
            Saved at {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Parameter table */}
      <Card surface="lowest" padding="none" className="overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 border-b border-outline/10 bg-surface-container-low px-5 py-3">
          <p className="w-52 shrink-0 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Parameter
          </p>
          <p className="flex-1 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            
          </p>
          <p className="w-16 shrink-0 text-center font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Weight
          </p>
          <span className="w-3 shrink-0" />
        </div>

        <ul className="divide-y divide-outline/5">
          {PARAMETERS.map((param) => (
            <li key={param.key}>
              <WeightRow
                label={param.label}
                description={param.description}
                icon={param.icon}
                value={weights[param.key]}
                onChange={(v) => handleChange(param.key, v)}
              />
            </li>
          ))}
        </ul>
      </Card>

      {/* Total weight bar */}
      <div className="mt-4 rounded-xl border border-outline/10 bg-surface-container-low px-5 py-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-on-surface">Total Weight</span>
          <span className={`flex items-center gap-1.5 font-headline text-sm font-bold ${totalColorClass}`}>
            {totalState === "valid" && <Icon name="check_circle" size={15} filled />}
            {totalState === "over"  && <Icon name="error" size={15} filled />}
            {totalState === "under" && <Icon name="info" size={15} filled />}
            {total} / 100
            {totalState !== "valid" && (
              <span className="font-label text-xs font-normal">
                {totalState === "over"
                  ? `(${total - 100} over limit)`
                  : `(${100 - total} remaining)`}
              </span>
            )}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
            style={{ width: `${Math.min(total, 100)}%` }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" leadingIcon="restart_alt" onClick={handleReset}>
          Reset to Defaults
        </Button>
        <Button
          variant="primary"
          leadingIcon={saving ? undefined : "save"}
          onClick={handleSave}
          disabled={total !== 100 || saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
