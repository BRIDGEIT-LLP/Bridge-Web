"use client";

import { Icon } from "@/components/ui/Icon";

interface TablePagerProps {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  /** Row range currently shown, for the "Showing x–y of n" label. */
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Plural noun for the label, e.g. "users" / "administrators". */
  noun: string;
  onPage: (page: number) => void;
}

/**
 * The footer row under an admin table: "Showing x–y of n <noun>" plus prev/next.
 * Shared by User Management and Admin Management so the markup exists once.
 */
export function TablePager({ page, totalPages, rangeStart, rangeEnd, total, noun, onPage }: TablePagerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline/10 px-5 py-4">
      <p className="text-sm text-on-surface-variant">
        Showing {rangeStart}–{rangeEnd} of {total} {noun}
      </p>
      <div className="flex items-center gap-1">
        <PageButton icon="chevron_left" disabled={page <= 1} onClick={() => onPage(page - 1)} />
        <span className="px-3 text-sm font-semibold text-on-surface">
          {page} / {totalPages}
        </span>
        <PageButton icon="chevron_right" disabled={page >= totalPages} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}

function PageButton({ icon, disabled, onClick }: { icon: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
