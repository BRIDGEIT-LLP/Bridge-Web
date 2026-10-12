/**
 * Single source of truth for the 5-step Corporate Portal registration flow.
 * The Stitch screens used inconsistent step counts; we normalize to 5 steps
 * using the Step-1 stepper labels (Details → Verification → Address →
 * Authorized → Finalize). Consumed by StepProgress and the OnboardingProvider's
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
  { key: "details", route: "/registration", label: "Details", title: "Company Registration" },
  { key: "verification", route: "/registration/verify-account", label: "Verification", title: "Secure your account" },
  { key: "profile", route: "/registration/complete-profile", label: "Profile", title: "Complete your profile" },
  { key: "kycdoc", route: "/registration/document-upload", label: "KYC-DOC", title: "Document Upload" },
  { key: "status", route: "/registration/verification-status", label: "Status", title: "Verification in Progress" },
];

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

/** Progress 0–100 for the given step (step N of 5 → N*20). */
export function progressForStep(key: string): number {
  return Math.round((stepNumber(key) / ONBOARDING_STEPS.length) * 100);
}
