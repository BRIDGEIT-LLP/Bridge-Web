"use client";

import React from "react";
import { Modal } from "@/components/modal/Modal";

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user reaches the end of the terms and clicks "I Agree". */
  onAgree: () => void;
}


  // Terms of Service & Privacy Policy consent dialog. Reuses the shared `Modal`
  // (thin-scrollbar body). There is no fixed footer — the "I Agree" button sits at
  // the very end of the scrollable terms, so it is only revealed once the user has
  // scrolled through the content.
 
  // NOTE: the copy below is placeholder content and is meant to be replaced with
  // the real Terms / Privacy text.
 
export function TermsModal({ open, onClose, onAgree }: TermsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Terms of Service & Privacy Policy" footer={null}>
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-on-surface-variant">
        <p className="text-xs font-medium italic text-outline">
          The following is placeholder content and will be replaced with the final
          Terms of Service and Privacy Policy.
        </p>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">1. Acceptance of Terms</h3>
          <p>
            By creating an account on the Corporate Portal, you agree to be bound by these
            Terms of Service and our Privacy Policy. If you are entering into this agreement
            on behalf of a company or other legal entity, you represent that you have the
            authority to bind that entity to these terms.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">2. Use of the Platform</h3>
          <p>
            You agree to use the platform only for lawful purposes and in accordance with
            these terms. You are responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your account.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">3. Corporate Data Handling</h3>
          <p>
            We collect and process company registration details, authorized representative
            information, and uploaded verification documents solely to provide and improve
            our verification and onboarding services. Data is stored securely and is not
            shared with third parties except as required to deliver the service or comply
            with applicable law.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">4. Verification &amp; Compliance</h3>
          <p>
            You consent to the verification of the information and documents you provide,
            including government-issued identifiers, against applicable registries and
            third-party verification providers. You confirm that all information submitted
            is accurate, current, and complete.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">5. Privacy Policy</h3>
          <p>
            Our Privacy Policy describes how we collect, use, retain, and protect your
            personal and corporate data. By accepting these terms you acknowledge that you
            have read and understood the Privacy Policy and consent to the described data
            practices, including storage and processing of your information.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">6. Limitation of Liability</h3>
          <p>
            The platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
            To the maximum extent permitted by law, we disclaim all warranties and shall not
            be liable for any indirect, incidental, or consequential damages arising from your
            use of the service.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">7. Changes to These Terms</h3>
          <p>
            We may update these terms from time to time. Continued use of the platform after
            any changes become effective constitutes your acceptance of the revised terms.
            We encourage you to review this page periodically.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-headline text-base font-bold text-on-surface">8. Contact</h3>
          <p>
            If you have any questions about these Terms of Service or our Privacy Policy,
            please contact our support team through the portal. By clicking &quot;I Agree&quot;
            below, you confirm that you have read, understood, and agree to be bound by these
            terms in their entirety.
          </p>
        </section>

        {/* Action lives at the end of the content, so it appears only after scrolling. */}
        <div className="flex justify-center border-t border-outline/10 pt-5">
          <button
            type="button"
            onClick={onAgree}
            className="flex h-11 items-center justify-center rounded-xl bg-primary px-8 font-bold text-on-primary transition-colors hover:bg-primary-dim"
          >
            I Agree
          </button>
        </div>
      </div>
    </Modal>
  );
}
