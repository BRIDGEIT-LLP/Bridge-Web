import Link from "next/link";

/** The four-step journey shown below the hero. */
const JOURNEY_STEPS = [
  {
    title: "Establish trust",
    body: "Role-based onboarding, business verification and controlled access.",
  },
  {
    title: "Understand intent",
    body: "Structured requirements, sector context, geography and commercial fit.",
  },
  {
    title: "Recommend opportunities",
    body: "Explainable matching that shows both fit and the underlying business ask.",
  },
  {
    title: "Move to action",
    body: "Permissioned introductions, connection management and a secure Deal Room.",
  },
];

/**
 * Public landing page rendered at "/". Ported from the BridgeConnect demo's
 * intro screen; CTAs route into the real login and registration flows.
 * The global Navbar (root layout) provides the header, same as every other route.
 */
export function LandingPage() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">
        {/* Hero */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2050d8] via-[#0f45b8] to-[#0d2f7e] p-8 sm:p-12 lg:col-span-8">
            {/* Decorative rings, bottom-right */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -right-16 size-80 rounded-full border border-white/10"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-44 -right-32 size-[28rem] rounded-full border border-white/10"
            />

            <div className="relative flex flex-col gap-7">
              <span className="font-label text-xs font-bold uppercase tracking-[0.15em] text-[#9db8f2]">
                Client demonstration · BridgeConnect
              </span>
              <h1 className="max-w-2xl font-headline text-4xl font-extrabold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl xl:text-[56px]">
                Turning business intent into{" "}
                <span className="text-[#a7c0f8]">trusted, actionable introductions.</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-[#ccd8f5] sm:text-lg">
                BridgeConnect is a verified business network designed to reduce the time,
                uncertainty and relationship friction involved in finding the right commercial
                partner.
              </p>

              <div className="flex max-w-2xl flex-col gap-1 rounded-xl border border-white/10 bg-[#0b2a72]/50 p-5">
                <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-[#93aef0]">
                  Our operating thesis
                </span>
                <strong className="font-headline text-base font-bold text-white sm:text-lg">
                  Trust establishes access. Intent creates relevance. Context enables action.
                </strong>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="flex h-12 items-center justify-center rounded-lg bg-[#2e6bef] px-6 font-headline text-base font-bold text-white shadow-lg shadow-black/20 transition-colors hover:bg-[#2a61da]"
                >
                  Begin client demo →
                </Link>
                <Link
                  href="/registration"
                  className="flex h-12 items-center justify-center rounded-lg bg-white px-6 font-headline text-base font-bold text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  Explore member onboarding
                </Link>
              </div>
            </div>
          </div>

          {/* Industry gap */}
          <aside
            aria-label="The industry gap"
            className="ambient-shadow flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-6 sm:p-7 lg:col-span-4"
          >
            <div className="flex flex-col gap-2">
              <span className="font-label text-xs font-bold uppercase tracking-[0.15em] text-primary">
                The industry gap
              </span>
              <b className="font-headline text-[22px] font-extrabold leading-snug text-on-surface">
                Strong networks still rely on weak signals.
              </b>
            </div>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Conventional directories and referrals reveal who exists, but rarely establish
              trust, capture the real commercial ask or support a governed path to engagement.
            </p>
            <div className="flex items-center gap-4 rounded-xl bg-surface-container-low p-4">
              <div className="flex flex-col">
                <small className="font-label text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  From
                </small>
                <b className="text-sm text-on-surface">Contact discovery</b>
              </div>
              <span className="text-lg text-primary">→</span>
              <div className="flex flex-col">
                <small className="font-label text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  To
                </small>
                <b className="text-sm text-on-surface">Opportunity readiness</b>
              </div>
            </div>
            <div className="mt-auto border-l-4 border-primary bg-primary-container/40 p-4 text-sm font-bold leading-relaxed text-on-surface">
              Not another lead list—a decision-support layer for credible business relationships.
            </div>
          </aside>
        </section>

        {/* Demo journey */}
        <section
          aria-label="Demo journey"
          className="ambient-shadow flex flex-col gap-10 rounded-2xl bg-surface-container-lowest p-7 sm:p-10"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-16">
            <span className="max-w-[190px] shrink-0 font-label text-xs font-bold uppercase leading-relaxed tracking-[0.15em] text-primary">
              What this demo will show
            </span>
            <p className="max-w-xl text-lg leading-relaxed text-on-surface-variant">
              A focused journey from verified identity to a commercially relevant conversation.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
            {JOURNEY_STEPS.map((step, i) => (
              <article
                key={step.title}
                className={`flex gap-4 ${i % 2 === 1 ? "md:border-l md:border-outline-variant/30 md:pl-12" : ""}`}
              >
                <span className="font-headline text-lg font-extrabold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="font-headline text-lg font-bold text-on-surface">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-on-surface-variant">{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
