"use client";

import { useRouter } from "next/navigation";
import { User } from "lucide-react";

interface AccountSummaryProps {
  firstName?: string;
  lastName?: string;
  legalName?: string;
  email?: string;
  countryCode?: string;
  contact?: string;
  /** Where "Edit" goes; defaults to the Apply step. */
  editHref?: string;
}

/**
 * One-line account summary (name · company · email · mobile) with an Edit link, shown on both tabs
 * of the Your profile step. Styled by registration.css, so render it inside the `.bp` wrapper.
 */
export function AccountSummary({
  firstName,
  lastName,
  legalName,
  email,
  countryCode,
  contact,
  editHref = "/registration",
}: AccountSummaryProps) {
  const router = useRouter();
  return (
    <div className="banner info small" style={{ padding: "10px 14px" }}>
      <User size={16} />
      <span className="grow [overflow-wrap:anywhere]">
        <strong>{`${firstName ?? ""} ${lastName ?? ""}`.trim() || "Your account"}</strong>
        {legalName ? ` · ${legalName}` : ""}
        {email ? ` · ${email}` : ""}
        {contact ? ` · ${countryCode ?? ""} ${contact}` : ""}
      </span>
      <button type="button" onClick={() => router.push(editHref)} className="link small">
        Edit
      </button>
    </div>
  );
}
