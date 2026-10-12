"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  type PanInfo,
} from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { CompatibilityRing } from "@/components/dashboard/explore/CompatibilityRing";
import {
  ROLE_GRADIENT,
  ROLE_ICON,
  ROLE_LABEL,
  companyInitials,
  contactLinks,
  formatLocation,
  prettyTag,
  roleFacts,
} from "@/lib/explore-format";
import type { ExploreDecision, ExploreMatch } from "@/types/api.types";

/**
 * One match rendered as a full-bleed "Shorts Mode" swipe card. Shows the Matching
 * Engine result (organization, role, compatibility score, short bio and sector tags)
 * over the profile photo, or a role-colored initials avatar when there's no photo.
 * Used by `ProfileShortsDeck`, which owns the queue/decision logic — this component
 * is purely the card + gestures.
 *
 * Gestures (active card only): drag left = reject, drag right = send/connect,
 * drag down = skip. The deck can also command an exit (action buttons / keyboard)
 * via `commandedExit`. Either way, once the card flies off `onExit(decision)` fires.
 */

const SWIPE_DISTANCE = 120;
const SWIPE_VELOCITY = 600;

const EXIT_TARGET: Record<ExploreDecision, { x?: number; y?: number }> = {
  reject: { x: -700 },
  send: { x: 700 },
  skip: { y: 800 },
};

/** Presentational card face (full-bleed portrait + match info). No motion/gestures. */
export function ProfileCardFace({ match }: { match: ExploreMatch }) {
  const fullName = [match.first_name, match.last_name].filter(Boolean).join(" ").trim();
  const location = formatLocation(match.country, match.continent);
  const contacts = contactLinks(match);
  const facts = roleFacts(match).slice(0, 4);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-surface-container-highest shadow-2xl">
      {/* Background: profile photo if it loads, otherwise an initials avatar */}
      <Avatar
        photoKey={match.profile_photo}
        alt={fullName || match.organization_name}
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      >
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br ${ROLE_GRADIENT[match.role]}`}
        >
          <span className="font-headline text-[5rem] font-black text-white/90 sm:text-[7rem]">
            {companyInitials(fullName || match.organization_name)}
          </span>
        </div>
      </Avatar>

      {/* Compatibility score — top-right circular progress ring */}
      <div className="absolute right-4 top-4 z-10">
        <CompatibilityRing value={match.compatibility} className="text-white drop-shadow-lg" />
      </div>

      {/* Readability gradient + content */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pb-24 text-white sm:p-5 sm:pb-24">
        <div className="space-y-2 sm:space-y-2.5">
          {/* Name + role + organization */}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-headline text-lg font-bold leading-tight text-white sm:text-xl">
                {fullName || match.organization_name}
              </h3>
              {match.compatibility >= 80 && (
                <Icon name="verified" size={18} filled className="shrink-0 text-secondary-fixed-dim" />
              )}
            </div>
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-secondary-fixed-dim">
              <Icon name={ROLE_ICON[match.role]} size={16} className="shrink-0" />
              <span className="shrink-0">{ROLE_LABEL[match.role]}</span>
              <span className="truncate font-normal text-white/70">· {match.organization_name}</span>
            </p>
          </div>

          {/* Location */}
          {location && (
            <span className="flex min-w-0 items-center gap-1 text-xs text-white/70">
              <Icon name="location_on" size={14} className="shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}

          {/* Contact info — icon + value (display only, no links) */}
          {contacts.length > 0 && (
            <div className="space-y-1">
              {contacts.map((c) => (
                <div key={c.label} className="flex min-w-0 items-center gap-2 text-xs text-white/80">
                  <Icon name={c.icon} size={14} className="shrink-0 text-white/60" />
                  <span className="truncate">{c.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Short bio (hidden when the backend sends null) */}
          {match.short_bio && (
            <p className="line-clamp-2 text-xs text-white/75">{match.short_bio}</p>
          )}

          {/* Primary sector tags */}
          <div className="flex flex-wrap gap-1.5">
            {match?.primary_sector?.map((sector) => (
              <span
                key={sector}
                className="rounded-full border border-white/10 bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md"
              >
                {prettyTag(sector)}
              </span>
            ))}
          </div>

          {/* Role-based details */}
          {facts.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-white/20 pt-2.5">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-white/50">
                    {fact.label}
                  </span>
                  <span className="block truncate text-xs font-semibold text-white">
                    {fact.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProfileShortsCardProps {
  match: ExploreMatch;
  /** Set by the deck to command an exit (button / keyboard). Null = no command. */
  commandedExit: ExploreDecision | null;
  /** Fires once the card has animated off screen. */
  onExit: (decision: ExploreDecision) => void;
  /**
   * Right-swipe / connect intent. Instead of committing immediately, the deck opens
   * the proposal modal; the card springs back to center so it stays put until the
   * user either sends (deck then commands the exit) or cancels.
   */
  onSendIntent: () => void;
}

export function ProfileShortsCard({ match, commandedExit, onExit, onSendIntent }: ProfileShortsCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const controls = useAnimationControls();

  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const rejectOpacity = useTransform(x, [-SWIPE_DISTANCE, -40], [1, 0]);
  const sendOpacity = useTransform(x, [40, SWIPE_DISTANCE], [0, 1]);
  const skipOpacity = useTransform(y, [40, SWIPE_DISTANCE], [0, 1]);

  const flyOut = (decision: ExploreDecision) => {
    controls
      .start({
        ...EXIT_TARGET[decision],
        opacity: 0,
        transition: { duration: 0.4, ease: "easeOut" },
      })
      .then(() => onExit(decision));
  };

  useEffect(() => {
    if (commandedExit) flyOut(commandedExit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to a new command
  }, [commandedExit]);

  const springBack = () =>
    controls.start({ x: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) {
      flyOut("reject");
    } else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) {
      // Connect: open the proposal modal first; keep the card in place until sent.
      springBack();
      onSendIntent();
    } else if (info.offset.y > SWIPE_DISTANCE || info.velocity.y > SWIPE_VELOCITY) {
      flyOut("skip");
    } else {
      springBack();
    }
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      style={{ x, y, rotate }}
      animate={controls}
      drag
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 0.98 }}
    >
      <ProfileCardFace match={match} />

      {/* Directional cue badges */}
      <motion.div
        style={{ opacity: rejectOpacity }}
        className="pointer-events-none absolute left-6 top-8 -rotate-12 rounded-xl border-4 border-error px-4 py-1.5 text-xl font-black uppercase tracking-widest text-error"
      >
        Reject
      </motion.div>
      <motion.div
        style={{ opacity: sendOpacity }}
        className="pointer-events-none absolute right-6 top-8 rotate-12 rounded-xl border-4 border-white px-4 py-1.5 text-xl font-black uppercase tracking-widest text-white"
      >
        Connect
      </motion.div>
      <motion.div
        style={{ opacity: skipOpacity }}
        className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 rounded-xl border-4 border-white/80 px-4 py-1.5 text-xl font-black uppercase tracking-widest text-white/90"
      >
        Skip
      </motion.div>
    </motion.div>
  );
}
