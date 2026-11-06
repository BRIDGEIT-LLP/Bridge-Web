/**
 * Single source of truth for the 7-step member application flow
 * (Apply → Verify → Business → Profile → Intent → Documents → Review). Consumed by StepProgress and the OnboardingProvider's
 * goNext/goBack helpers so navigation and progress never drift.
 */

export interface OnboardingStep {
  key: string;
  /** Top-level route. */
  route: string;
  /** Stepper label (matches the Step-1 stepper). */
  label: string;
  /** Page title. */
  title: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "details", route: "/registration", label: "Apply", title: "Apply for membership" },
  { key: "verification", route: "/registration/verify-account", label: "Verify", title: "Secure your account" },
  { key: "business", route: "/registration/business-check", label: "Business", title: "Check your business" },
  { key: "profile", route: "/registration/complete-profile", label: "Profile", title: "Your profile" },
  { key: "intent", route: "/registration/intent", label: "Intent", title: "What are you looking for?" },
  { key: "kycdoc", route: "/registration/document-upload", label: "Documents", title: "Upload your documents" },
  { key: "review", route: "/registration/review", label: "Review", title: "Review your application" },
];

/** Post-submission screen. Deliberately outside the stepper (the progress bar ends at Review). */
export const STATUS_ROUTE = "/registration/verification-status";

export const STEP_LABELS = ONBOARDING_STEPS.map((s) => s.label);

export function getStep(key: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.key === key);
}

export function getStepIndex(key: string): number {
  return ONBOARDING_STEPS.findIndex((s) => s.key === key);
}

/** Resolve a step from a route (e.g. "/registration/verify-account"). */
export function getStepByRoute(route: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.route === route);
}

/** 1-based step number, e.g. 2. */
export function stepNumber(key: string): number {
  return getStepIndex(key) + 1;
}

/** Progress 0–100 for the given step, counting only completed steps (step N of 5 → (N-1)*20). */
export function progressForStep(key: string): number {
  return Math.round(((stepNumber(key) - 1) / ONBOARDING_STEPS.length) * 100);
}
