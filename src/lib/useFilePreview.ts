"use client";

import { useEffect, useState } from "react";
import { getFilePreview } from "@/services/file.service";
import type { ApiError } from "@/lib/axios";

function blobKind(blob: Blob): { isPdf: boolean; isHtml: boolean } {
  const type = (blob.type || "").toLowerCase();
  return {
    isPdf: type.startsWith("application/pdf"),
    isHtml: type.startsWith("text/html"),
  };
}

export interface FilePreviewState {
  /** Object URL for the fetched blob, or null while loading / on error. */
  url: string | null;
  /** True when the fetched file is a PDF (render in an iframe instead of <img>). */
  isPdf: boolean;
  /** True when the server converted an office doc (Word / Excel) to watermarked HTML. */
  isHtml: boolean;
  loading: boolean;
  error: string | null;
}

/** Resolved fetch result, tagged with the key it belongs to. */
interface Resolved {
  key: string;
  url: string | null;
  isPdf: boolean;
  isHtml: boolean;
  error: string | null;
}

/**
 * Fetch the watermarked server copy for a stored file by its `s3Key` and expose it
 * as an object URL. Pass `null` to fetch nothing. The object URL is revoked when the
 * key changes or the component unmounts; in-flight requests are cancelled so a stale
 * response never overwrites a newer one. `loading` is derived (true whenever a key is
 * set but its result hasn't resolved yet), so the effect only sets state in callbacks.
 */
export function useFilePreview(s3Key: string | null): FilePreviewState {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!s3Key) return;
    let url: string | null = null;
    let cancelled = false;
    getFilePreview(s3Key)
      .then((blob) => {
        if (cancelled) return;
        // 204 No Content — the key points at a file that isn't in storage. Only
        // avatars answer this way (see fileController.filePreview), and they're
        // optional, so resolve to "nothing" and let the call site's fallback show
        // rather than handing an empty blob to <img>.
        if (blob.size === 0) {
          setResolved({ key: s3Key, url: null, isPdf: false, isHtml: false, error: null });
          return;
        }
        url = URL.createObjectURL(blob);
        setResolved({ key: s3Key, url, ...blobKind(blob), error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setResolved({
          key: s3Key,
          url: null,
          isPdf: false,
          isHtml: false,
          error: (err as ApiError)?.message || "Couldn't load the preview.",
        });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [s3Key]);

  // Only trust `resolved` when it matches the current key; otherwise we're loading.
  const current = resolved && resolved.key === s3Key ? resolved : null;
  return {
    url: current?.url ?? null,
    isPdf: current?.isPdf ?? false,
    isHtml: current?.isHtml ?? false,
    loading: !!s3Key && !current,
    error: current?.error ?? null,
  };
}
