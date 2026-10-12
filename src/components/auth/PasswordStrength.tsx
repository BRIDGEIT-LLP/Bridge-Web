"use client";

import { Icon } from "@/components/ui/Icon";

/**
 * Live password checklist + strength meter, shared by the password-reset flow and
 * company registration. The rules below together equal the canonical PASSWORD_REGEX
 * in `lib/validation.ts` — change both together.
 */
export const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "A number", test: (v) => /\d/.test(v) },
  { label: "A special character (@$!%*?&)", test: (v) => /[@$!%*?&]/.test(v) },
];

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];

/** How many of the rules the given value satisfies. */
export function metRuleCount(value: string) {
  return PASSWORD_RULES.filter((r) => r.test(value)).length;
}

/** "Strength: Fair" caption above a 4-segment bar. */
export function PasswordStrengthMeter({ value }: { value: string }) {
  const met = metRuleCount(value);
  const filledBars = Math.round((met / PASSWORD_RULES.length) * 4);
  return (
    <div className="pt-1">
      <span className="text-[10px] font-bold uppercase text-on-surface-variant">
        Strength: {STRENGTH_LABELS[met]}
      </span>
      <div className="mt-1.5 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < filledBars ? "bg-primary" : "bg-surface-variant"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** The "Password Requirements" card, each rule ticking off as it's satisfied. */
export function PasswordRequirements({ value }: { value: string }) {
  return (
    <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
      <p className="font-label text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
        Password Requirements
      </p>
      <div className="grid grid-cols-1 gap-y-2">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <div
              key={rule.label}
              className={`flex items-center gap-3 text-sm transition-opacity ${
                met ? "text-on-surface-variant" : "text-on-surface-variant opacity-60"
              }`}
            >
              <Icon
                name={met ? "check_circle" : "circle"}
                size={18}
                filled={met}
                className={met ? "text-primary" : "text-outline"}
              />
              <span className={met ? "font-medium" : ""}>{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
