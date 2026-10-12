"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { scanImage, scanDocument } from "@/services/file.service";
import type { DocType } from "@/config/docTypes";
import type { ApiError } from "@/lib/axios";
import type { ScannedDoc } from "@/components/onboarding/DocumentUploadCard";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";

/** Trim a stored document key; empty / whitespace-only counts as missing. */
function storedKey(value?: string | null): string {
  return (value ?? "").trim();
}

interface FileUploadFieldProps {
  label: string;
  /** Show a blue "Optional" after the label (non-mandatory field). */
  optional?: boolean;
  /** Accepted MIME types, comma-separated (e.g. "application/pdf"). */
  accept?: string;
  /** Optional max file size in MB; oversize files are rejected. */
  maxSizeMB?: number;
  /** Helper text shown when no file is selected. */
  hint?: string;
  /**
   * Fired with the scanned result (file + s3Key) once the upload succeeds, or
   * null when the file is removed / rejected / still scanning.
   */
  onChange: (result: ScannedDoc | null) => void;
  /** External error (e.g. "required") shown when there's no internal reject. */
  error?: string;
  /** Enforce a file via native form validation. */
  required?: boolean;
  id?: string;
  /** Which scan endpoint to hit on select. */
  scanType: "image" | "document";
  /** Document type sent to the scan API. */
  docType: DocType;
  /**
   * Already-stored S3 key (GET /users/profile, form reset). Without this the
   * control only knows about a file picked in *this* session, so a returning
   * user with a saved incorporation certificate / pitch deck looks empty.
   */
  value?: string;
}

/**
 * Compact single-line file picker: an "Upload" button that shows the selected
 * file name (with a remove control) once a file is chosen. On select the file is
 * virus-scanned + uploaded (with an inline loader); the s3Key is surfaced via onChange.
 */
export function FileUploadField({
  label,
  optional,
  accept,
  maxSizeMB,
  hint = "No file chosen",
  onChange,
  error,
  required,
  id,
  scanType,
  docType,
  value,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [s3Key, setS3Key] = useState<string | null>(storedKey(value) || null);
  const [uploading, setUploading] = useState(false);
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Prefill / reset from the parent (RHF reset after GET /users/profile) without
  // wiping a file the user just picked in this session.
  useEffect(() => {
    if (file) return;
    setS3Key(storedKey(value) || null);
  }, [value, file]);

  // Mirror the latest file so the async scan callback can detect a stale result.
  const fileRef = useRef<File | null>(null);
  fileRef.current = file;

  const acceptedTypes = (accept ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  const rejectReason = (f: File): string | null => {
    if (acceptedTypes.length && !acceptedTypes.includes(f.type)) return "Unsupported file type.";
    if (maxSizeMB != null && f.size > maxSizeMB * 1024 * 1024) return `File must be ${maxSizeMB} MB or smaller.`;
    return null;
  };

  const choose = async (f: File | null) => {
    if (f) {
      const reason = rejectReason(f);
      if (reason) {
        setRejectMsg(reason);
        return;
      }
    }
    setRejectMsg(null);
    setFile(f);
    fileRef.current = f;
    // Clear any previous key until this file is (re-)scanned.
    setS3Key(null);
    onChange(null);

    if (!f) {
      setUploading(false);
      return;
    }

    setUploading(true);
    try {
      const fn = scanType === "image" ? scanImage : scanDocument;
      const res = await fn(f, { docType });
      if (fileRef.current !== f) return; // superseded
      setS3Key(res.s3Key);
      onChange({ file: f, s3Key: res.s3Key, mimetype: f.type, fileName: f.name, fileSize: f.size });
    } catch (err) {
      if (fileRef.current !== f) return;
      // Drop the file on failure.
      setFile(null);
      fileRef.current = null;
      setS3Key(null);
      setRejectMsg((err as ApiError)?.message || "Upload failed. Please try again.");
      onChange(null);
    } finally {
      if (fileRef.current === f || !fileRef.current) setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
        {required && <span className="align-middle text-base leading-none text-error"> *</span>}
        {optional && <span className="font-medium normal-case text-primary"> (Optional)</span>}
      </span>

      <div className="relative flex min-w-0 items-center gap-3">
        {required && (
          // Focusable, visually-hidden mirror so native form validation enforces a
          // *scanned* file (keyed off the s3Key, not just a local selection).
          <input
            tabIndex={-1}
            aria-hidden="true"
            required
            value={s3Key ?? ""}
            onChange={() => {}}
            className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
          />
        )}
        <button
          type="button"
          id={id}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-container-highest px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-60 sm:px-4"
        >
          <Icon name="upload_file" size={18} />
          {s3Key ? "Replace" : "Upload"}
        </button>

        {uploading ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-on-surface-variant">
            <Icon name="progress_activity" size={16} className="shrink-0 animate-spin text-primary" />
            <span className="truncate">Scanning…</span>
          </span>
        ) : file ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-on-surface">
            <Icon name="description" size={16} className="shrink-0 text-primary" />
            <span className="truncate">{file.name}</span>
            {s3Key && <Icon name="check_circle" size={16} filled className="shrink-0 text-primary" />}
            <button
              type="button"
              onClick={() => choose(null)}
              aria-label="Remove file"
              className="flex shrink-0 items-center text-on-surface-variant transition-colors hover:text-error"
            >
              <Icon name="close" size={16} />
            </button>
          </span>
        ) : s3Key ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-on-surface">
            <Icon name="description" size={16} className="shrink-0 text-primary" />
            <span className="truncate">Document uploaded</span>
            <Icon name="check_circle" size={16} filled className="shrink-0 text-primary" />
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-label={`Preview ${label}`}
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary transition-colors hover:opacity-80"
            >
              <Icon name="visibility" size={16} />
              Preview
            </button>
            <button
              type="button"
              onClick={() => choose(null)}
              aria-label="Remove file"
              className="flex shrink-0 items-center text-on-surface-variant transition-colors hover:text-error"
            >
              <Icon name="close" size={16} />
            </button>
          </span>
        ) : (
          <span className="min-w-0 truncate text-sm text-on-surface-variant">{hint}</span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            choose(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>

      {(rejectMsg ?? error) && (
        <span className="px-1 text-xs font-medium text-error">{rejectMsg ?? error}</span>
      )}

      <DocumentPreviewModal
        s3Key={previewOpen ? s3Key : null}
        onClose={() => setPreviewOpen(false)}
        title={label}
      />
    </div>
  );
}
