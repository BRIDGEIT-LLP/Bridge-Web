"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/common/loader";
import { useFilePreview } from "@/lib/useFilePreview";
import { getOriginalFile } from "@/services/file.service";
import type { ApiError } from "@/lib/axios";

interface DocumentPreviewModalProps {
  /** S3 key of the file to preview; `null` closes the modal. */
  s3Key: string | null;
  onClose: () => void;
  title?: string;
  /** When true, show a Download button (saves the watermarked preview copy). Default false. */
  downloadAllowed?: boolean;
  /** File name used for the download and the "not previewable" fallback. */
  fileName?: string;
  /** MIME type of the file. When it isn't an image, PDF, or converted HTML
   *  (docx / xls / xlsx), an inline preview can't be rendered and a fallback is
   *  shown instead. Omit to keep the legacy image/PDF behavior. */
  mimeType?: string;
  /** Hide the browser's built-in PDF viewer toolbar (Download/Print). Use this so a
   *  view-only file can't be saved from the native toolbar — download is then only
   *  possible via our own gated button. Default false (keeps the native toolbar). */
  hidePdfToolbar?: boolean;
}

/**
 * Click-to-preview dialog for a stored document. Fetches the watermarked server copy
 * by `s3Key` (via `useFilePreview`) and renders it as an image, PDF, or HTML (Word
 * / Excel converted server-side), with loading and error states. Reused by the
 * document-upload card, verification-status page, KYC review, and the deal-room
 * shared files (with a conditional download button).
 */
export function DocumentPreviewModal({
  s3Key,
  onClose,
  title = "Document Preview",
  downloadAllowed = false,
  fileName,
  mimeType,
  hidePdfToolbar = false,
}: DocumentPreviewModalProps) {
  const { url, isPdf, isHtml, loading, error } = useFilePreview(s3Key);
  const [downloading, setDownloading] = useState(false);

  // Chromium honors these fragment params to hide the embedded PDF viewer's toolbar
  // (Download/Print). Applied when the caller wants to prevent saving from the native UI.
  const pdfSrc = url && hidePdfToolbar ? `${url}#toolbar=0&navpanes=0&scrollbar=0` : url;

  // Images, PDFs, and server-converted HTML (.docx / Excel) can be rendered inline.
  // If a mimeType is provided and it's none of those, show a fallback instead of a
  // broken <img>. When mimeType is omitted (legacy callers like KYC), keep the original
  // isPdf-based image/PDF behavior unless the server already returned HTML.
  const isImage = mimeType ? mimeType.startsWith("image/") : !isPdf && !isHtml;
  const canRenderInline = isPdf || isHtml || isImage;
  const isSpreadsheet =
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    /\.xlsx?$/i.test(fileName || "");
  const isPresentation =
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    /\.pptx?$/i.test(fileName || "");
  const isWideHtmlPreview = isSpreadsheet || isPresentation;

  // Images/PDFs download the already-fetched watermarked preview (same format).
  // Word/Excel preview is converted HTML — fetch the stored original instead.
  const handleDownload = async () => {
    const name = fileName || "download";
    const save = (href: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    if (isHtml && s3Key) {
      if (downloading) return;
      setDownloading(true);
      try {
        const blob = await getOriginalFile(s3Key);
        const href = URL.createObjectURL(blob);
        save(href);
        URL.revokeObjectURL(href);
      } catch (err) {
        toast.error((err as ApiError)?.message ?? "Couldn't download the file.");
      } finally {
        setDownloading(false);
      }
      return;
    }

    if (!url) return;
    save(url);
  };

  const footer =
    downloadAllowed && url ? (
      <Button variant="secondary" leadingIcon="download" onClick={handleDownload} disabled={downloading}>
        {downloading ? "Downloading…" : "Download"}
      </Button>
    ) : undefined;

  return (
    <Modal
      open={!!s3Key}
      onClose={onClose}
      title={title}
      footer={footer}
      overlayZClass="z-[60]"
      maxWidthClass={isWideHtmlPreview ? "max-w-6xl" : "max-w-2xl"}
      bodyClassName={
        isWideHtmlPreview
          ? "thin-scrollbar flex-1 overflow-hidden p-2 sm:p-3"
          : undefined
      }
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader size="large" className="text-primary" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <Icon name="error" size={32} className="text-error" />
          <span className="text-sm font-medium text-error">{error}</span>
        </div>
      ) : url && canRenderInline ? (
        isHtml ? (
          <iframe
            src={url}
            title="Document preview"
            className="w-full rounded-lg bg-white"
            style={{ height: isWideHtmlPreview ? "65vh" : "70vh", border: 0 }}
            sandbox={isWideHtmlPreview ? "allow-same-origin allow-scripts" : "allow-same-origin"}
          />
        ) : isPdf ? (
          <iframe src={pdfSrc ?? undefined} title="Document preview" className="h-[70vh] w-full rounded-lg" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Document preview" className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg" />
        )
      ) : url ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
          <Icon name="description" size={40} className="text-on-surface-variant" />
          <span className="text-sm font-medium text-on-surface">{fileName || "This file"}</span>
          <span className="text-xs text-on-surface-variant">
            Preview isn&apos;t available for this file type
            {/\.ppt$/i.test(fileName || "") && !/\.pptx$/i.test(fileName || "")
              ? " (legacy .ppt — share as .pptx)."
              : /\.doc$/i.test(fileName || "")
                ? " (legacy .doc — share as .docx or PDF)."
                : "."}
            {downloadAllowed ? " Use Download to open it." : " It is view-only."}
          </span>
        </div>
      ) : null}
    </Modal>
  );
}
