"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";

/**
 * Final screen of the password-reset flow ("Forgot Password - Success" in Stitch).
 * Confirms the reset succeeded and routes the user back to sign in. The `basePath`
 * prop sets the route prefix so the CTA lands on the right portal's sign-in page.
 */
export function ResetSuccessScreen({ basePath = "/login" }: { basePath?: string }) {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <Card
        padding="lg"
        className="relative w-full max-w-[480px] overflow-hidden text-center !p-8 sm:!p-12"
      >
        {/* Decorative ambient glows (no hard borders, per the design system) */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-48 rounded-full bg-secondary/5 blur-3xl" />

        {/* Success icon */}
        <div className="mb-8 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="check_circle" size={48} filled />
          </div>
        </div>

        <h1 className="mb-4 font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          Password Reset Successfully
        </h1>
        <p className="mb-10 font-body text-lg leading-relaxed text-on-surface-variant">
          All active sessions have been logged out for your security. Your account is now
          fully protected with your new credentials.
        </p>

        <div className="flex flex-col gap-4">
          <Link
            href={basePath}
            className="cta-gradient group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline text-base font-bold !text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01]"
          >
            <span>Login Again</span>
            <Icon
              name="arrow_forward"
              size={20}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>

          <div className="border-t border-outline-variant/20 pt-4">
            <p className="text-sm font-medium text-on-surface-variant">
              Need help?{" "}
              <Link
                href="#"
                className="font-bold text-primary border-b border-transparent hover:border-current transition-colors"
              >
                Contact Security Support
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}
