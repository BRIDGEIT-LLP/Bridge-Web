"use client";

import { Card } from "@/components/ui/Card";

export interface HomeStat {
  label: string;
  value: string;
  caption: string;
}

/** S10 Home stat row — 4 flat cards (label / big number / caption), matching the
 *  design's minimal style. Deliberately NOT the icon-chip `StatGrid` used elsewhere
 *  in the app (that's the older Stitch-era dashboard convention; S10 is flatter). */
export function HomeStatRow({ stats }: { stats: HomeStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} surface="lowest" padding="md">
          <p className="text-xs text-on-surface-variant sm:text-sm">{stat.label}</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-on-surface sm:text-3xl">
            {stat.value}
          </p>
          <p className="mt-1 truncate text-xs text-on-surface-variant">{stat.caption}</p>
        </Card>
      ))}
    </div>
  );
}
