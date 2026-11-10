"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { companyInitials } from "@/lib/explore-format";
import { relativeTime } from "@/components/dashboard/deal-room/deal-room-meta";
import { avatarColorClass } from "./avatar-color";
import type { ConnectionRequest } from "@/types/api.types";

/** S10 "Requests for you" panel — pending incoming connection requests. Each row
 *  deep-links to the Connections screen (accept/decline/defer lives there, not
 *  inline on Home), matching the design's "View" button per row. */
export function RequestsForYouPanel({ requests }: { requests: ConnectionRequest[] }) {
  return (
    <Card surface="lowest" padding="md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-headline text-base font-bold text-on-surface sm:text-lg">
          Requests for you
        </h2>
        <Link href="/dashboard/connections" className="text-xs font-semibold text-primary hover:underline sm:text-sm">
          All requests
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No pending requests right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant/30">
          {requests.map((request) => (
            <li key={request.id} className="flex items-center gap-3 py-2.5">
              <Avatar photoKey={request.photoKey} alt={request.name} className="size-9 shrink-0 rounded-full">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColorClass(request.name)}`}
                >
                  {companyInitials(request.name)}
                </div>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface">{request.name}</p>
                <p className="truncate text-xs text-on-surface-variant">
                  {request.intent || "Connection request"}
                  {request.createdAt ? ` · ${relativeTime(request.createdAt)}` : ""}
                </p>
              </div>
              <Link
                href="/dashboard/connections"
                className="shrink-0 rounded-lg border border-outline-variant/50 px-3 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
