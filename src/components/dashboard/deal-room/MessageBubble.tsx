"use client";

import { Icon } from "@/components/ui/Icon";
import { ROLE_AVATAR_GRADIENT } from "@/lib/connections";
import { Avatar } from "@/components/ui/Avatar";
import { useFilePreview } from "@/lib/useFilePreview";
import { clockTime, initials } from "./deal-room-meta";
import type { DealAttachment, DealCounterparty, DealMessage, PreviewableFile } from "./types";

/** Human-readable file size, e.g. "1.4 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Attachment({
  file,
  mine,
  onPreview,
}: {
  file: DealAttachment;
  mine: boolean;
  onPreview?: (file: PreviewableFile) => void;
}) {
  // Clicking opens the watermarked preview modal (needs a server s3Key; freshly-picked
  // or demo attachments without one simply don't open).
  const open = () => onPreview?.(file);

  // `file.url` is only set for a locally-picked file pending upload (composer). Server
  // messages carry "" (see DealAttachment.url) and need the watermarked preview fetched
  // by s3Key instead — same endpoint the preview modal already uses.
  const needsFetch = file.kind === "image" && !file.url && !!file.s3Key;
  const { url: fetchedUrl, loading } = useFilePreview(needsFetch ? file.s3Key! : null);
  const imageSrc = file.url || fetchedUrl;

  if (file.kind === "image") {
    return (
      <button type="button" onClick={open} className="mb-1.5 block w-full" aria-label={`Preview ${file.name}`}>
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL / server preview, not a static asset
          <img src={imageSrc} alt={file.name} className="max-h-56 w-full rounded-lg object-cover" />
        ) : (
          <div
            className={`flex h-40 w-full items-center justify-center rounded-lg ${
              mine ? "bg-on-primary/15" : "bg-surface-container-high"
            }`}
          >
            <Icon
              name={loading ? "hourglass_empty" : "image"}
              size={28}
              className={mine ? "text-on-primary" : "text-on-surface-variant"}
            />
          </div>
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className={`mb-1.5 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-opacity hover:opacity-90 ${
        mine ? "bg-on-primary/15" : "bg-surface-container-high"
      }`}
    >
      <Icon name="description" size={26} className={mine ? "text-on-primary" : "text-on-surface-variant"} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{file.name}</span>
        <span className={`block text-[11px] ${mine ? "text-on-primary/70" : "text-on-surface-variant"}`}>
          {formatSize(file.size)}
        </span>
      </span>
    </button>
  );
}

interface MessageBubbleProps {
  message: DealMessage;
  /** Rendered as the small avatar next to counterparty ("them") messages. */
  counterparty: DealCounterparty;
  /** Open the watermarked preview modal for this message's attachment. */
  onPreview?: (file: PreviewableFile) => void;
}

/**
 * A single chat message — counterparty messages sit left with an avatar and a light
 * bubble; mine sit right in a solid primary bubble. Timestamp goes below the bubble.
 */
export function MessageBubble({ message, counterparty, onPreview }: MessageBubbleProps) {
  const mine = message.sender === "me";

  return (
    // Row: avatar (them only) + a flex-1/min-w-0 column that owns a DEFINITE width.
    <div className={`flex w-full items-end gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <Avatar
          photoKey={counterparty.photoKey}
          alt={counterparty.name}
          className="mb-5 size-8 shrink-0 rounded-full"
        >
          <span
            className={`mb-5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${ROLE_AVATAR_GRADIENT[counterparty.role]} text-[11px] font-bold text-on-primary`}
          >
            {initials(counterparty.name)}
          </span>
        </Avatar>
      )}

      {/* flex-1 + min-w-0 gives this column a definite, shrinkable width. Alignment of the
          (inline-block) bubble inside is done with text-align, NOT flexbox — so the bubble
          is an inline-block, which respects max-width and wraps long words instead of being
          forced wide by the flex min-content rule (the bug that stretched/cut the bubble). */}
      <div className={`min-w-0 flex-1 ${mine ? "text-right" : "text-left"}`}>
        {/* maxWidth is set via inline style, NOT a Tailwind arbitrary class: this
            Turbopack + Tailwind v4 setup does not generate arbitrary percentage max-w
            utilities (only max-w-full), so `max-w-[85%]` produced no rule and the bubble
            grew unbounded. Inline style always applies. */}
        <div
          style={{ maxWidth: "80%", overflowWrap: "anywhere", wordBreak: "break-word" }}
          className={`inline-block rounded-2xl px-4 py-2.5 text-left align-bottom whitespace-pre-wrap ${
            mine
              ? "rounded-br-sm bg-primary text-on-primary"
              : "rounded-tl-sm bg-surface-container-high text-on-surface"
          }`}
        >
          {message.attachment && <Attachment file={message.attachment} mine={mine} onPreview={onPreview} />}
          {message.text && <span className="text-sm leading-relaxed">{message.text}</span>}
        </div>
        <div className={`mt-1 flex items-center gap-1.5 px-1 ${mine ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">
            {clockTime(message.at)}
          </span>
          {mine && (
            <span className="group relative flex items-center">
              <Icon
                name={message.read ? "done_all" : "done"}
                size={18}
                className={message.read ? "text-primary" : "text-on-surface-variant"}
              />
              {/* Themed hover tooltip (matches the app surface, not a native black box). */}
              <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-nowrap rounded-lg border border-outline-variant/40 bg-surface-container-highest px-2.5 py-1 text-[11px] font-semibold text-on-surface shadow-lg group-hover:block">
                {message.read ? "Seen" : "Delivered"}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
