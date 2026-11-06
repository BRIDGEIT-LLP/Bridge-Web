"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { companyInitials } from "@/lib/explore-format";
import { DEAL_STAGES, relativeTime } from "@/components/dashboard/deal-room/deal-room-meta";
import { avatarColorClass } from "./avatar-color";
import type { DealRoom } from "@/components/dashboard/deal-room/types";

/** S10 "Deal rooms" panel — active deal rooms, each row linking straight into the
 *  room's chat (chevron affordance), matching the design's Home layout. */
export function DealRoomsPanel({ dealRooms }: { dealRooms: DealRoom[] }) {
  return (
    <Card surface="lowest" padding="md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-headline text-base font-bold text-on-surface sm:text-lg">
          Deal rooms
        </h2>
        <Link href="/dashboard/deal-room" className="text-xs font-semibold text-primary hover:underline sm:text-sm">
          All rooms
        </Link>
      </div>

      {dealRooms.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No active deal rooms yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant/30">
          {dealRooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/dashboard/deal-room/${room.id}`}
                className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-container/60"
              >
                <Avatar
                  photoKey={room.counterparty.photoKey}
                  alt={room.counterparty.name}
                  className="size-9 shrink-0 rounded-full"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColorClass(room.counterparty.name)}`}
                  >
                    {companyInitials(room.counterparty.name)}
                  </div>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">{room.counterparty.name}</p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {DEAL_STAGES[room.stage]} · {relativeTime(room.lastActivityAt)}
                  </p>
                </div>
                <Icon name="chevron_right" size={18} className="shrink-0 text-on-surface-variant" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
