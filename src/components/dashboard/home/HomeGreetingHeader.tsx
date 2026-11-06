"use client";

import { Icon } from "@/components/ui/Icon";

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** S10 Home header — personalized greeting + notification bell (per the design's
 *  "Good afternoon, Priya" treatment). The bell is decorative for now: there is no
 *  notifications feature in Bridge-Server yet (FRD §10 defines triggers but no
 *  backend endpoint exists), so it carries no unread count or click behavior. */
export function HomeGreetingHeader({ firstName }: { firstName: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <h1 className="font-headline text-xl font-extrabold tracking-[-0.02em] text-on-surface sm:text-2xl md:text-3xl">
        {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ""}
      </h1>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant ambient-shadow">
        <Icon name="notifications" size={20} />
      </span>
    </div>
  );
}
