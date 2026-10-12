import React from "react";
import { Icon } from "@/components/ui/Icon";
import { Loader } from "@/components/common/loader";

interface AsyncStateProps {
  loading: boolean;
  error: string | null;
  /** Show the empty state instead of `children` when there's no data. */
  isEmpty?: boolean;
  emptyIcon?: string;
  emptyText?: string;
  /** Retry handler shown under the error message. */
  onRetry?: () => void;
  children: React.ReactNode;
}

/**
 * Renders the shared loading / error / empty branches for a data fetch, falling
 * through to `children` once data is present. Used by the admin tables, lists, and
 * detail drawers so those states aren't re-implemented per screen.
 */
export function AsyncState({ loading, error, isEmpty, emptyIcon = "inbox", emptyText = "Nothing here yet.", onRetry, children }: AsyncStateProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader size="large" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon name="cloud_off" size={36} className="text-on-surface-variant" />
        <p className="text-sm text-on-surface-variant">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-surface-container-high px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-highest"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Icon name={emptyIcon} size={36} className="text-on-surface-variant" />
        <p className="text-sm text-on-surface-variant">{emptyText}</p>
      </div>
    );
  }
  return <>{children}</>;
}
