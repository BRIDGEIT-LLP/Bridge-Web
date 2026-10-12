"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Loader } from "@/components/common/loader";
import { VideoPreviewModal } from "@/components/onboarding/VideoPreviewModal";
import { scanVideo, INTRO_VIDEO_MIME_TYPES, INTRO_VIDEO_MAX_MB } from "@/services/file.service";
import type { ApiError } from "@/lib/axios";

interface VideoUploadFieldProps {
  label?: string;
  /** Stored s3 key of the saved intro video ("" / null = none). */
  value?: string | null;
  /** Fired with the new s3 key after a successful upload, or "" when removed. */
  onChange: (s3Key: string) => void;
  /** When false the row is view-only: Preview is offered, upload / remove are not. */
  editable?: boolean;
  /** Shows the lock marker next to the label (field not editable for this role). */
  locked?: boolean;
  hint?: string;
}

/**
 * Optional intro-video control: Upload / Replace / Remove (with upload progress) plus a
 * Preview button that opens `VideoPreviewModal`. The file is virus-scanned and stored by
 * the backend; only its s3 key is kept in the form. A video picked in this session plays
 * from the local file; a previously saved one is streamed through a signed URL.
 */
export function VideoUploadField({
  label = "Short Intro Video",
  value,
  onChange,
  editable = true,
  locked = false,
  hint = `MP4, WebM or MOV. Max size of ${INTRO_VIDEO_MAX_MB}MB`,
}: VideoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasVideo = Boolean(value);

  // Release the local object URL on unmount.
  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Let the same file be re-picked after a failure.
    e.target.value = "";
    if (!f) return;
    if (!INTRO_VIDEO_MIME_TYPES.includes(f.type)) {
      toast.error("Intro video must be an MP4, WebM or MOV file.");
      return;
    }
    if (f.size > INTRO_VIDEO_MAX_MB * 1024 * 1024) {
      toast.error(`Intro video must be ${INTRO_VIDEO_MAX_MB}MB or smaller.`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const { s3Key } = await scanVideo(f, setProgress);
      setLocalUrl(URL.createObjectURL(f));
      setFileName(f.name);
      onChange(s3Key);
    } catch (err) {
      toast.error((err as ApiError)?.message ?? "Couldn't upload your video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const remove = () => {
    setLocalUrl(null);
    setFileName(null);
    onChange("");
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
        <span className="font-medium normal-case text-primary"> (Optional)</span>
        {locked && <Icon name="lock" size={12} className="ml-1 align-middle text-outline-variant" />}
      </span>

      <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3.5 py-2">
        {uploading ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-on-surface-variant">
            <Loader size={16} />
            <span className="truncate">{progress < 100 ? `Uploading… ${progress}%` : "Scanning…"}</span>
          </span>
        ) : hasVideo ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-on-surface">
            <Icon name="videocam" size={16} className="shrink-0 text-primary" />
            <span className="truncate">{fileName ?? "Intro video uploaded"}</span>
            <Icon name="check_circle" size={16} filled className="shrink-0 text-primary" />
          </span>
        ) : (
          <span className="text-sm text-outline-variant">{editable ? hint : "Not uploaded"}</span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {hasVideo && !uploading && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-label="Preview intro video"
              title="Preview"
              className="flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-primary transition-colors hover:bg-primary-container/40 sm:h-auto sm:w-auto sm:rounded-lg sm:px-2.5 sm:py-1"
            >
              <Icon name="visibility" size={16} />
              <span className="hidden sm:inline">Preview</span>
            </button>
          )}

          {editable && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={INTRO_VIDEO_MIME_TYPES.join(",")}
                onChange={handleFile}
                className="hidden"
                aria-hidden
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                aria-label={hasVideo ? "Replace intro video" : "Upload intro video"}
                title={hasVideo ? "Replace" : "Upload"}
                className="flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-primary transition-colors hover:bg-primary-container/40 disabled:opacity-60 sm:h-auto sm:w-auto sm:rounded-lg sm:px-2.5 sm:py-1"
              >
                <Icon name="upload_file" size={16} />
                <span className="hidden sm:inline">{hasVideo ? "Replace" : "Upload"}</span>
              </button>
              {hasVideo && !uploading && (
                <button
                  type="button"
                  onClick={remove}
                  aria-label="Remove intro video"
                  title="Remove"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-error"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <VideoPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={label}
        localUrl={localUrl}
      />
    </div>
  );
}
