/**
 * Profile completeness, weighted like the prototype (onboarding.js `completeness`):
 * mandatory fields count for 70%, recommended for 20% and optional for 10%.
 * Each group scores the share of its fields that are filled; an empty group counts as full.
 */
export const COMPLETENESS_WEIGHTS = { required: 70, recommended: 20, optional: 10 } as const;

export interface CompletenessGroups {
  required: unknown[];
  recommended: unknown[];
  optional: unknown[];
}

/** True when a form/profile value counts as "filled in". */
export function isFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(isFilled);
  return true;
}

export function weightedCompleteness({ required, recommended, optional }: CompletenessGroups): number {
  const share = (list: unknown[]) => (list.length ? list.filter(isFilled).length / list.length : 1);
  return Math.round(
    share(required) * COMPLETENESS_WEIGHTS.required +
      share(recommended) * COMPLETENESS_WEIGHTS.recommended +
      share(optional) * COMPLETENESS_WEIGHTS.optional,
  );
}
