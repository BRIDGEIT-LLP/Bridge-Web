"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

export interface Stat {
  label: string;
  value: string;
  icon: string;
}

/** Page header for a role view: title + subtitle. */
export function ViewHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-headline text-xl font-extrabold tracking-[-0.02em] text-on-surface sm:text-2xl md:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-on-surface-variant sm:text-base">{subtitle}</p>
    </div>
  );
}

/** Responsive grid of stat cards — placeholder metrics per role. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} surface="lowest" padding="md" className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/50 text-primary">
            <Icon name={s.icon} size={24} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-on-surface-variant">{s.label}</p>
            <p className="font-headline text-2xl font-bold text-on-surface">{s.value}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Full role view: header + stats + a placeholder content panel. */
export function RoleDashboard({
  title,
  subtitle,
  stats,
  placeholder,
}: {
  title: string;
  subtitle: string;
  stats: Stat[];
  placeholder: string;
}) {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      <ViewHeader title={title} subtitle={subtitle} />
      <StatGrid stats={stats} />
      <Card surface="lowest" padding="lg" className="mt-6">
        <p className="text-on-surface-variant">{placeholder}</p>
      </Card>
    </div>
  );
}
