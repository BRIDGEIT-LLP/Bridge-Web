/**
 * Marketing copy for the /landing-page route. Text is duplicated (not imported)
 * from the auth/onboarding screens so the marketing page never couples to them:
 * ROLES/STEPS/WHY originate in SignInScreen.tsx, the CTA body in registration/page.tsx.
 */

export const HERO = {
  eyebrow: "Bridge Platform",
  titleLead: "Where businesses, startups & ",
  titleAccent: "investors connect",
  subline:
    "Whether you're scaling a startup, sourcing investment, or growing your supply chain — Bridge matches you with verified partners who fit.",
};

export const ROLES = [
  {
    icon: "rocket_launch",
    title: "Startups & Founders",
    body: "Pitch your vision to pre-vetted investors. Share traction, funding ask, and team details — get matched with angels, VCs, and PE firms aligned to your stage.",
  },
  {
    icon: "trending_up",
    title: "Investors & Funds",
    body: "Discover high-potential startups filtered by sector, stage, and ticket size. Review founder profiles, traction metrics, and connect through private deal rooms.",
  },
  {
    icon: "handshake",
    title: "B2B Partnerships",
    body: "Find manufacturers, distributors, exporters, and buyers across 20+ industries. Match by intent, geography, and revenue band to build your supply chain.",
  },
];

export const STEPS = [
  {
    title: "Choose Your Path",
    body: "Sign up and select your mode — B2B partnerships, Founder seeking investors, or Investor discovering startups.",
  },
  {
    title: "Get Matched Intelligently",
    body: "Our algorithm pairs founders with investors by sector and stage, and matches B2B partners by intent and geography.",
  },
  {
    title: "Connect with Confidence",
    body: "Every profile is verified. Send connection requests, accept pitches, and start conversations — no spam, no noise.",
  },
  {
    title: "Close in Deal Rooms",
    body: "Private deal rooms for negotiations, document sharing, AI-powered suggestions, and scheduling calls.",
  },
];

export const WHY = [
  {
    icon: "verified_user",
    title: "Verification-first",
    body: "Every profile is vetted before you see it.",
  },
  {
    icon: "dashboard_customize",
    title: "Three tailored modes",
    body: "Purpose-built experiences for B2B, Founders, and Investors.",
  },
  {
    icon: "auto_awesome",
    title: "AI compatibility scoring",
    body: "Smart recommendations surface the partners most likely to fit.",
  },
  {
    icon: "public",
    title: "Pan-India network",
    body: "A network spanning 20+ industries and 35+ countries.",
  },
];

export const STATS = [
  { value: "5,000+", label: "Corporate partners" },
  { value: "20+", label: "Industries" },
  { value: "35+", label: "Countries" },
];

export const CTA = {
  heading: "Connect with confidence",
  body: "Join over 5,000 corporate partners who trust Bridge to find verified counterparts — from first introduction to closed deal.",
};
