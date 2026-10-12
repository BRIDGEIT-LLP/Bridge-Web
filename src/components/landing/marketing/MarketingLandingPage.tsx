"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { BrandLockup } from "@/components/layout/navbar";
import { HERO, ROLES, STEPS, WHY, STATS, CTA } from "./content";
import { fadeUp, stagger, VIEWPORT } from "./motion";

export function MarketingLandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-full bg-background">
        <LandingHeader />
        <Hero />
        <RoleCards />
        <HowItWorks />
        <WhyBridge />
        <StatsStrip />
        <FinalCta />
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}

/** Small uppercase section eyebrow, same pattern as SignInScreen's SectionLabel. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-xs font-bold uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{label}</SectionLabel>
      <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

function LandingHeader() {
  return (
    <header className="glass-panel sticky top-0 z-40 border-b border-outline-variant/30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/landing-page" aria-label="Bridge Platform home">
          <BrandLockup />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="hidden px-2 text-sm font-bold text-on-surface-variant transition-colors hover:text-on-surface sm:block"
          >
            Sign in
          </Link>
          <Button href="/registration" className="!h-10 whitespace-nowrap !px-5 !text-sm">
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" aria-label="Introduction">
      {/* Decorative on-palette ambience behind the hero copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-[28rem] -translate-x-[80%] rounded-full bg-primary-container/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/2 size-[24rem] translate-x-[20%] rounded-full bg-primary-container/40 blur-3xl"
      />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28"
      >
        <motion.span
          variants={fadeUp}
          className="rounded-full bg-primary-container px-4 py-1.5 font-label text-xs font-bold uppercase tracking-wider text-on-primary-container"
        >
          {HERO.eyebrow}
        </motion.span>
        <motion.h1
          variants={fadeUp}
          className="font-headline text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-on-surface sm:text-5xl lg:text-6xl"
        >
          {HERO.titleLead}
          <span className="text-primary">{HERO.titleAccent}</span>
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="mx-auto max-w-2xl text-lg leading-relaxed text-on-surface-variant"
        >
          {HERO.subline}
        </motion.p>
        <motion.div variants={fadeUp} className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <Button href="/registration" trailingIcon="arrow_forward">
            Get started
          </Button>
          <Button href="/login" variant="secondary">
            Sign in
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}

function RoleCards() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" aria-label="Who Bridge serves">
      <SectionHeading label="Built for every stage" title="One network, three ways in" />
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        className="mt-10 grid gap-6 md:grid-cols-3"
      >
        {ROLES.map((role) => (
          <motion.div
            key={role.title}
            variants={fadeUp}
            className="ambient-shadow rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-8 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
              <Icon name={role.icon} size={26} />
            </div>
            <h3 className="mt-5 font-headline text-xl font-bold text-on-surface">{role.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{role.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="bg-surface-container-low py-16 sm:py-20" aria-label="How it works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading label="How it works" title="From sign-up to signed deal" />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="relative mt-12 grid gap-10 md:grid-cols-4"
        >
          {/* Desktop connector line running behind the numbered badges. */}
          <div aria-hidden className="absolute top-5 left-0 hidden h-px w-full bg-outline-variant/60 md:block" />
          {STEPS.map((step, i) => (
            <motion.div key={step.title} variants={fadeUp} className="relative flex flex-col gap-3">
              <div className="cta-gradient flex size-10 items-center justify-center rounded-full font-headline font-bold text-on-primary">
                {i + 1}
              </div>
              <h3 className="font-headline text-lg font-bold text-on-surface">{step.title}</h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">{step.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function WhyBridge() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" aria-label="Why Bridge">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <SectionHeading label="Why Bridge" title="Signal over noise, by design" />
          <p className="text-base leading-relaxed text-on-surface-variant">
            Bridge is built so every introduction is worth your time — verified counterparts,
            matched by intent, ready to move.
          </p>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="grid gap-6 sm:grid-cols-2 lg:col-span-7"
        >
          {WHY.map((item) => (
            <motion.div key={item.title} variants={fadeUp} className="flex flex-col gap-2">
              <div className="text-primary">
                <Icon name={item.icon} size={28} />
              </div>
              <h3 className="font-headline text-base font-bold text-on-surface">{item.title}</h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">{item.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-label="Bridge by the numbers">
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        className="ambient-shadow grid grid-cols-1 gap-10 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-12 text-center sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-outline-variant/30"
      >
        {STATS.map((stat) => (
          <motion.div key={stat.label} variants={fadeUp} className="flex flex-col gap-2">
            <span className="bg-gradient-to-br from-[#2050d8] to-[#0d2f7e] bg-clip-text font-headline text-4xl font-extrabold text-transparent sm:text-5xl">
              {stat.value}
            </span>
            <span className="font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24" aria-label="Get started">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2050d8] via-[#0f45b8] to-[#0d2f7e] p-10 text-center sm:p-16"
      >
        {/* Soft glow + faint rings, echoing the hero treatment on the demo page. */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-[#4f7ff0]/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 size-80 rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-44 -right-32 size-[28rem] rounded-full border border-white/10" />
        <div className="relative flex flex-col items-center gap-4">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {CTA.heading}
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-[#ccd8f5]">{CTA.body}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/registration"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-headline text-base font-bold tracking-tight text-primary transition-transform hover:scale-[1.01] active:scale-[0.98]"
            >
              Create your account
              <Icon name="arrow_forward" size={20} />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl px-6 font-headline text-base font-bold tracking-tight text-on-primary transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-outline-variant/30 bg-surface-container-lowest">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <BrandLockup />
          <p className="text-sm text-on-surface-variant">Verified partners who fit.</p>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-on-surface-variant">
          <Link href="/login" className="transition-colors hover:text-on-surface">
            Sign in
          </Link>
          <Link href="/registration" className="transition-colors hover:text-on-surface">
            Get started
          </Link>
        </div>
      </div>
      <div className="border-t border-outline-variant/20">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-on-surface-variant sm:px-6">
          © {new Date().getFullYear()} Bridge Platform. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
