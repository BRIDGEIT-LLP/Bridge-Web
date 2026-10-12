"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { scanImage, scanDocument } from "@/services/file.service";
import type { DocType, DocSide } from "@/config/docTypes";
import type { ApiError } from "@/lib/axios";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";

export interface UploadSlot {
  key: string;
  label: string;
  side?: DocSide;
}

export interface ScannedDoc {
  file: File;
  s3Key: string;
  /** File metadata forwarded to save-kyc-info (sourced from the uploaded File). */
  mimetype: string;
  fileName: string;
  fileSize: number;
}

interface DocumentUploadCardProps {
  title: string;
  subtitle: string;
  /** Material Symbols icon for the document badge. */
  icon: string;
  hint?: string;
  /** One or more upload slots (e.g. Front Side / Back Side). */
  slots: UploadSlot[];
  /**
   * Fired after a slot is successfully scanned/removed, with the scanned result
   * (file + s3Key) per slot key. A slot only appears here once its scan succeeds.
   */
  onChange?: (docs: Record<string, ScannedDoc>) => void;
  /** Override accepted MIME types (defaults to PNG/JPG). */
  accept?: string;
  /** Optional max file size in MB; oversize files are rejected with a message. */
  maxSizeMB?: number;
  /** Which scan endpoint to hit on select. */
  scanType: "image" | "document";
  /** Document type sent to the scan API for every slot in this card. */
  docType: DocType;
}

const DEFAULT_ACCEPT = "image/png,image/jpeg";

function isImage(file: File) {
  return file.type.startsWith("image/");
}

export function DocumentUploadCard({
  title,
  subtitle,
  icon,
  hint = "PNG or JPG (max 10MB)",
  slots,
  onChange,
  accept = DEFAULT_ACCEPT,
  maxSizeMB,
  scanType,
  docType,
}: DocumentUploadCardProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  // S3 keys returned by a successful scan, per slot.
  const [s3Keys, setS3Keys] = useState<Record<string, string>>({});
  // Slots whose scan is in flight (drives the loader).
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  // Object URLs for image previews, kept so we can revoke them.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  // Per-slot rejection / scan-failure message.
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});

  // Click-to-preview modal: which slot's s3Key is being previewed.
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // Refs mirror the latest files/keys so async scan callbacks read fresh values.
  const filesRef = useRef(files);
  const keysRef = useRef(s3Keys);
  filesRef.current = files;
  keysRef.current = s3Keys;

  const acceptedTypes = accept.split(",").map((t) => t.trim()).filter(Boolean);

  const rejectReason = (file: File): string | null => {
    if (acceptedTypes.length && !acceptedTypes.includes(file.type)) {
      return "Unsupported file type.";
    }
    if (maxSizeMB != null && file.size > maxSizeMB * 1024 * 1024) {
      return `File must be ${maxSizeMB} MB or smaller.`;
    }
    return null;
  };

  // Revoke any remaining object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the parent payload from files + keys: a slot is reported only once it
  // has both a file and a successful s3Key.
  const emitScanned = (
    filesMap: Record<string, File | null>,
    keysMap: Record<string, string>
  ) => {
    const out: Record<string, ScannedDoc> = {};
    for (const s of slots) {
      const f = filesMap[s.key];
      const k = keysMap[s.key];
      if (f && k)
        out[s.key] = { file: f, s3Key: k, mimetype: f.type, fileName: f.name, fileSize: f.size };
    }
    onChange?.(out);
  };

  const clearSlotError = (key: string) =>
    setSlotErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const setSlot = async (key: string, file: File | null) => {
    // Validate type/size before accepting.
    if (file) {
      const reason = rejectReason(file);
      if (reason) {
        setSlotErrors((prev) => ({ ...prev, [key]: reason }));
        return;
      }
    }
    clearSlotError(key);

    // Refresh the preview (revoke old, create new for images only).
    const oldUrl = previews[key];
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    const newUrl = file && isImage(file) ? URL.createObjectURL(file) : undefined;
    setPreviews((prev) => {
      const next = { ...prev };
      if (newUrl) next[key] = newUrl;
      else delete next[key];
      return next;
    });

    // Set the file locally and clear any previous s3Key for this slot (it must be
    // re-scanned). Emitting now leaves the slot "incomplete" until the scan lands.
    const nextFiles = { ...filesRef.current, [key]: file };
    filesRef.current = nextFiles;
    setFiles(nextFiles);
    const clearedKeys = { ...keysRef.current };
    delete clearedKeys[key];
    keysRef.current = clearedKeys;
    setS3Keys(clearedKeys);
    emitScanned(nextFiles, clearedKeys);

    if (!file) {
      setUploading((prev) => ({ ...prev, [key]: false }));
      return;
    }

    // Scan + upload.
    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const fn = scanType === "image" ? scanImage : scanDocument;
      const side = slots.find((s) => s.key === key)?.side;
      const { s3Key } = await fn(file, { docType, side });
      // Bail if the slot's file changed/was removed while scanning.
      if (filesRef.current[key] !== file) return;
      const updatedKeys = { ...keysRef.current, [key]: s3Key };
      keysRef.current = updatedKeys;
      setS3Keys(updatedKeys);
      emitScanned(filesRef.current, updatedKeys);
    } catch (err) {
      if (filesRef.current[key] !== file) return;
      // Drop the file on failure so the slot returns to empty.
      const revertFiles = { ...filesRef.current };
      delete revertFiles[key];
      filesRef.current = revertFiles;
      setFiles(revertFiles);
      setPreviews((prev) => {
        const next = { ...prev };
        if (next[key]) {
          URL.revokeObjectURL(next[key]);
          delete next[key];
        }
        return next;
      });
      setSlotErrors((prev) => ({
        ...prev,
        [key]: (err as ApiError)?.message || "Upload failed. Please try again.",
      }));
      emitScanned(revertFiles, keysRef.current);
    } finally {
      if (filesRef.current[key] === file || !filesRef.current[key]) {
        setUploading((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  // All slots fully uploaded (scan succeeded) — drives the "UPLOADED" success state.
  const allUploaded = slots.every((s) => s3Keys[s.key]);

  return (
    <section
      className={`rounded-2xl p-3 sm:p-4 ${allUploaded ? "bg-surface-container-lowest ambient-shadow" : "bg-surface-container-low"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10 ${
              allUploaded ? "bg-secondary-fixed text-on-secondary-fixed" : "bg-surface-container-highest text-on-surface-variant"
            }`}
          >
            <Icon name={icon} size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-headline text-sm font-bold text-on-surface">{title}</h3>
            <p className="text-xs leading-snug text-on-surface-variant sm:text-sm">{subtitle}</p>
          </div>
        </div>
        {allUploaded && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-1 sm:px-3">
            <Icon name="check_circle" size={14} filled className="text-primary" />
            <span className="text-xs font-bold text-on-secondary-container">UPLOADED</span>
          </span>
        )}
      </div>

      <div className={`grid gap-3 ${slots.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {slots.map((slot) => {
          const file = files[slot.key];
          const previewUrl = previews[slot.key];
          const isUploading = !!uploading[slot.key];
          const isDone = !!s3Keys[slot.key];
          return (
            <div key={slot.key} className="flex flex-col gap-2">
              <span className="px-1 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                {slot.label}
              </span>

              {file ? (
                <div className="group relative h-32 overflow-hidden rounded-xl border-2 border-primary/20 bg-surface-container">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`${slot.label} preview`}
                      onClick={() => isDone && setPreviewKey(s3Keys[slot.key])}
                      className={`h-full w-full object-cover ${isDone ? "cursor-pointer" : ""}`}
                    />
                  ) : (
                    <div
                      onClick={() => isDone && setPreviewKey(s3Keys[slot.key])}
                      className={`flex h-full flex-col items-center justify-center gap-2 px-4 text-center ${isDone ? "cursor-pointer" : ""}`}
                    >
                      <Icon name="description" size={32} className="text-primary" />
                      <span className="line-clamp-2 break-all text-xs font-medium text-on-surface sm:text-sm">
                        {file.name}
                      </span>
                    </div>
                  )}

                  {/* Hover hint that the image opens a full preview */}
                  {isDone && !isUploading && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-3 py-1 text-xs font-bold text-on-surface shadow-sm backdrop-blur">
                        <Icon name="zoom_in" size={14} /> Preview
                      </span>
                    </div>
                  )}

                  {/* Scanning loader overlay */}
                  {isUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-container-lowest/70 backdrop-blur-sm">
                      <Icon name="progress_activity" size={28} className="animate-spin text-primary" />
                      <span className="text-xs font-bold text-on-surface">Scanning…</span>
                    </div>
                  )}

                  {/* Success badge — only after a successful scan */}
                  {isDone && (
                    <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-on-primary">
                      <Icon name="check" size={16} />
                    </span>
                  )}

                  {/* Change / remove controls (hidden while scanning) */}
                  {!isUploading && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => inputRefs.current[slot.key]?.click()}
                        className="flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-3 py-1 text-xs font-bold text-on-surface shadow-sm backdrop-blur transition-colors hover:bg-surface-container-lowest"
                      >
                        <Icon name="edit" size={14} /> Change
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlot(slot.key, null)}
                        aria-label="Remove file"
                        className="flex size-7 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:text-error"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRefs.current[slot.key]?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) setSlot(slot.key, dropped);
                  }}
                  className="group flex min-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-lowest/50 px-3 py-4 transition-colors hover:bg-surface-container-lowest sm:px-4"
                >
                  <div className="mb-2 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/5 transition-transform group-hover:scale-110 sm:size-10">
                    <Icon name="upload_file" size={20} className="text-primary" />
                  </div>
                  <p className="mb-0.5 text-center text-xs font-bold leading-snug text-on-surface sm:text-sm">
                    Click to upload or drag &amp; drop
                  </p>
                  <p className="text-center text-[11px] leading-snug text-on-surface-variant sm:text-xs">
                    {hint}
                  </p>
                </button>
              )}

              <input
                ref={(el) => {
                  inputRefs.current[slot.key] = el;
                }}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  setSlot(slot.key, e.target.files?.[0] ?? null);
                  // Reset so re-selecting the same file still fires onChange.
                  e.target.value = "";
                }}
              />

              {slotErrors[slot.key] && (
                <span className="px-1 text-xs font-medium text-error">{slotErrors[slot.key]}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Click-to-preview modal (watermarked server copy fetched by s3Key) */}
      <DocumentPreviewModal s3Key={previewKey} onClose={() => setPreviewKey(null)} />
    </section>
  );
}
