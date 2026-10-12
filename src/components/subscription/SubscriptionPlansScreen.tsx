"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";
import {
  getSubscriptionPlans,
  selectSubscriptionPlan,
  getUserSubscription,
} from "@/services/subscription.service";
import type { SubscriptionPlan, UserSubscriptionData } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";


// ─── sub-components ───────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan: boolean;
  isLoading: boolean;
  onSelect: (planId: number) => void;
}

function PlanCard({ plan, isCurrentPlan, isLoading, onSelect }: PlanCardProps) {
  const isYearly = plan.validity_days >= 365;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-shadow
        ${isCurrentPlan
          ? "border-blue-600 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:shadow-md"
        }`}
    >
      {/* Badge for active plan */}
      {isCurrentPlan && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
          Current Plan
        </span>
      )}

      {/* Plan name */}
      <h3 className="text-lg font-semibold text-gray-900">{plan.plan_name}</h3>

      {/* Valid till preview */}
      <p className="mt-1 text-sm text-gray-500">
        Valid till&nbsp;
        <span className="font-medium text-gray-700">
          {plan.valid_till_preview}
        </span>
      </p>

      {/* Divider */}
      <hr className="my-4 border-gray-200" />

      {/* Benefits — one per row */}
      <ul className="flex flex-1 flex-col gap-2">
        {plan.plan_benefits.map((benefit, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle
              size={16}
              className="mt-0.5 shrink-0 text-blue-500"
              aria-hidden="true"
            />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrentPlan || isLoading}
        className={`mt-6 flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors
          ${isCurrentPlan
            ? "cursor-default bg-blue-100 text-blue-600"
            : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          }`}
      >
        {isLoading ? (
          <>
            <Loader2 size={15} className="mr-2 animate-spin" />
            Processing…
          </>
        ) : isCurrentPlan ? (
          "Active"
        ) : isYearly ? (
          "Choose Yearly"
        ) : (
          "Choose Monthly"
        )}
      </button>
    </div>
  );
}

// ─── main screen ──────────────────────────────────────────────────────────────

export function SubscriptionPlansScreen() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] =
    useState<UserSubscriptionData | null>(null);
  const [fetchingPlans, setFetchingPlans] = useState(true);
  const [selectingPlanId, setSelectingPlanId] = useState<number | null>(null);

  // Load plans and current subscription in parallel on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [fetchedPlans, subscription] = await Promise.all([
          getSubscriptionPlans(),
          getUserSubscription(),
        ]);
        setPlans(fetchedPlans);
        setCurrentSubscription(subscription);
      } catch {
        toast.error("Failed to load subscription plans. Please try again.");
      } finally {
        setFetchingPlans(false);
      }
    };
    load();
  }, []);

  const handleSelectPlan = async (planId: number) => {
    setSelectingPlanId(planId);
    try {
      const result = await selectSubscriptionPlan({ plan_id: planId });
      if (result.success && result.data) {
        toast.success(`${result.data.plan_name} activated successfully!`);
        // Refresh the subscription state after selection
        const updated = await getUserSubscription();
        setCurrentSubscription(updated);
      } else {
        toast.error(result.message ?? "Failed to select plan. Please try again.");
      }
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message ?? "Failed to select plan. Please try again.");
    } finally {
      setSelectingPlanId(null);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (fetchingPlans) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Choose Your Plan</h1>
        <p className="mt-2 text-sm text-gray-500">
          Select the plan that fits your needs. You can switch at any time.
        </p>
      </div>

      {/* Current subscription banner */}
      {currentSubscription && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span className="font-medium">{currentSubscription.plan_name}</span>
          {" "}is active until{" "}
          <span className="font-medium">{currentSubscription.end_date}</span>.
        </div>
      )}

      {/* Plan cards */}
      {plans.length === 0 ? (
        <p className="text-center text-sm text-gray-500">
          No subscription plans are currently available. Please check back later.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={currentSubscription?.plan_id === plan.id}
              isLoading={selectingPlanId === plan.id}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>
      )}
    </div>
  );
}
