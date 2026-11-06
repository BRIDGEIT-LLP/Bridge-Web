/** Deterministic flat avatar-circle color per person, matching the S10 design's
 *  palette of solid initials circles (no role-based gradients on Home — those are
 *  an Explore-page convention). Picked from the app's existing design tokens. */
const PALETTE = [
  "bg-primary text-on-primary",
  "bg-[#0f766e] text-white", // teal — not in the token set; Home-only accent
  "bg-tertiary text-on-tertiary",
  "bg-[#9d174d] text-white", // magenta — not in the token set; Home-only accent
  "bg-secondary text-on-secondary",
];

export function avatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
