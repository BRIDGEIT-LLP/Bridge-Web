"use client";

import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { CompatibilityRing } from "@/components/dashboard/explore/CompatibilityRing";
import {
  ROLE_GRADIENT,
  ROLE_ICON,
  ROLE_LABEL,
  companyInitials,
  formatLocation,
  prettyTag,
  roleFacts,
} from "@/lib/explore-format";
import type { ExploreMatch } from "@/types/api.types";

/**
 * One match rendered as a static card for the Explore **grid** view. Shows the same
 * Matching Engine data as the swipe card (company, role, compatibility, bio and
 * sector tags), laid out for at-a-glance reading. Adapted from the Stitch
 * "Explore Experts – Entry Grid" screen.
 */
export function ProfileGridCard({
  match,
  onConnect,
  onViewProfile,
}: {
  match: ExploreMatch;
  onConnect: (match: ExploreMatch) => void;
  onViewProfile: (match: ExploreMatch) => void;
}) {
  const fullName = [match.first_name, match.last_name].filter(Boolean).join(" ").trim();
  const location = formatLocation(match.country, match.continent);
  const facts = roleFacts(match).slice(0, 6);

  const phone = match.country_code && match.mobile_number
    ? `${match.country_code} ${match.mobile_number}`
    : match.mobile_number ?? null;

  return (
    <div className="flex flex-col rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">

      {/* ── Header: avatar · identity · compatibility ── */}
      <div className="flex items-start gap-3 sm:gap-4">
        <Avatar
          photoKey={match?.profile_photo}
          alt={fullName || match.organization_name}
          className="size-14 shrink-0 rounded-xl sm:size-16"
        >
          <div
            className={`flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ROLE_GRADIENT[match.role]} text-lg font-black text-white sm:size-16`}
          >
            {companyInitials(fullName || match.organization_name)}
          </div>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate font-headline text-base font-bold text-on-surface sm:text-lg">
              {fullName || match.organization_name}
            </h3>
            {match.compatibility >= 80 && (
              <Icon name="verified" size={18} filled className="shrink-0 text-secondary" />
            )}
          </div>
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary sm:text-sm">
            <Icon name={ROLE_ICON[match.role]} size={15} className="shrink-0" />
            <span className="shrink-0">{ROLE_LABEL[match.role]}</span>
            <span className="truncate font-normal text-on-surface-variant">· {match.organization_name}</span>
          </p>
          {location && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-on-surface-variant">
              <Icon name="location_on" size={13} className="shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
        <CompatibilityRing value={match.compatibility} size={48} className="shrink-0 text-primary" />
      </div>

      {/* ── Bio ── */}
      {match.short_bio && (
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{match.short_bio}</p>
      )}

      {/* ── Body: sectors + rationale (left) · role facts (right) ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-outline-variant/30 pt-4 sm:grid-cols-2">

        {/* Left: sectors + rationale */}
        <div className="flex flex-col gap-3">
          <div>
            {/* <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                Primary Sector
              </span>
            </div> */}
            <div className="flex flex-wrap gap-1.5">
              {match?.primary_sector?.map((sector) => (
                <span
                  key={sector}
                  className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant"
                >
                  {prettyTag(sector)}
                </span>
              ))}
            </div>
          </div>

          {match.rationale && (
            <div>
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                Reason for suggestion
              </span>
              <span className="inline-block rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                {match.rationale}
              </span>
            </div>
          )}
        </div>

        {/* Right: role-specific facts */}
        {facts.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {facts.map((fact) => (
              <div key={fact?.label} className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                  {fact?.label}
                </span>
                <span className="block truncate text-xs font-bold text-on-surface">{fact.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/30 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5">
          {phone && (
            <a
              href={`tel:${match.mobile_number}`}
              className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-on-surface-variant transition-colors hover:text-primary"
            >
              <Icon name="call" size={14} className="shrink-0" />
              <span className="truncate">{phone}</span>
            </a>
          )}
          {match.company_email && (
            <a
              href={`mailto:${match.company_email}`}
              className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-on-surface-variant transition-colors hover:text-primary"
            >
              <Icon name="mail" size={14} className="shrink-0" />
              <span className="truncate">{match.company_email}</span>
            </a>
          )}
          {match.company_website_url && (
            <a
              href={match.company_website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-on-surface-variant transition-colors hover:text-primary"
            >
              <Icon name="language" size={14} className="shrink-0" />
              <span className="truncate">{match.company_website_url.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
          {(match.linkedin_profile_url || match.linkedin_url) && (
            <a
              href={(match.linkedin_profile_url || match.linkedin_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-on-surface-variant transition-colors hover:text-primary"
            >
              <Icon name="link" size={14} className="shrink-0" />
              <span>LinkedIn</span>
            </a>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onViewProfile(match)}
            className="flex-1 whitespace-nowrap rounded-xl border border-outline-variant/50 px-4 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container sm:flex-none sm:px-5"
          >
            View Full Profile
          </button>
          <button
            type="button"
            onClick={() => onConnect(match)}
            className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-transform active:scale-95 sm:flex-none sm:px-5"
          >
            <Icon name="person_add" size={15} className="shrink-0" />
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
