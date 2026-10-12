import type { Variants } from "framer-motion";

/** Shared scroll-reveal variants for the marketing landing page. */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.65, 0.36, 1] },
  },
};

/** Opacity-only reveal — used inside full-bleed gradient bands where a translate would repaint the backdrop. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

export const VIEWPORT = { once: true, amount: 0.25 } as const;
