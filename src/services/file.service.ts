import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type { DocType, DocSide } from "@/config/docTypes";
import type { ScanResult, GetKycDocsResponse } from "@/types/api.types";

/** Extra context sent with a scan so the backend knows which document this is. */
export interface ScanMeta {
  docType: DocType;
  /** Only for two-sided documents (Aadhaar front/back). */
  side?: DocSide;
}

/**
 * Virus-scan a file and upload it to S3, returning its `s3Key`.
 *
 * Files go up as `multipart/form-data` under the field name the backend's multer
 * config expects (`image` for scan-img, `document` for scan-document), alongside
 * `docType` (and `side` for Aadhaar). We override the axios instance's default
 * `application/json` with `undefined` so the browser sets the multipart boundary
 * itself — a fixed `multipart/form-data` string would omit the boundary and multer
 * would see no file.
 */
async function scan(
  url: string,
  field: "image" | "document",
  file: File,
  meta: ScanMeta
): Promise<ScanResult> {
  const form = new FormData();
  form.append(field, file);
  form.append("docType", meta.docType);
  if (meta.side) form.append("side", meta.side);
  const { data } = await api.post<{ data: ScanResult }>(url, form, {
    headers: { "Content-Type": undefined },
  });
  return data.data;
}

/** Scan + upload a PNG/JPEG image (Aadhaar / PAN). */
export const scanImage = (file: File, meta: ScanMeta): Promise<ScanResult> =>
  scan(API_ENDPOINTS.SCAN_IMG, "image", file, meta);

/** Scan + upload a PDF document (incorporation certificate, pitch deck, …). */
export const scanDocument = (file: File, meta: ScanMeta): Promise<ScanResult> =>
  scan(API_ENDPOINTS.SCAN_DOCUMENT, "document", file, meta);

/** Accepted intro-video formats and size cap (mirrors the backend `videoUpload`). */
export const INTRO_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const INTRO_VIDEO_MAX_MB = 30;

/**
 * Scan + upload an intro video (MP4 / WebM / MOV, max 30 MB). `onProgress` receives
 * 0–100 while the bytes go up; the scan runs server-side after the upload completes.
 * No axios timeout is set on the instance, so a slow connection won't abort mid-upload.
 */
export async function scanVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ScanResult> {
  const form = new FormData();
  form.append("video", file);
  form.append("docType", "INTRO_VIDEO");
  const { data } = await api.post<{ data: ScanResult }>(API_ENDPOINTS.SCAN_VIDEO, form, {
    headers: { "Content-Type": undefined },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data.data;
}

/** Whose intro video to play. Omit to play the signed-in user's own. */
export interface IntroVideoTarget {
  userId: string;
  companyId?: string;
  roleId: number;
}

/**
 * Short-lived (3 min) signed URL for an intro video. Fetched fresh each time the
 * preview opens — never cached, since the link expires.
 */
export const getIntroVideoUrl = async (target?: IntroVideoTarget): Promise<string> => {
  const { data } = await api.get<{ data: { url: string } }>(API_ENDPOINTS.VIDEO_URL, {
    params: target ? { userId: target.userId, companyId: target.companyId, roleId: target.roleId } : undefined,
  });
  return data.data.url;
};

/**
 * Preview cache, keyed by the (immutable) `s3Key`. Without it a chat thread with N
 * image attachments issues N separate blob downloads, and opening one of those images
 * in the preview modal downloads the very same bytes a second time.
 *
 * We cache the **Blob, never an object URL** — each consumer keeps creating and
 * revoking its own URL (see `lib/useFilePreview.ts`), so one component unmounting can
 * never blank out another that's sharing the same blob. Caching the promise also means
 * simultaneous mounts share a single in-flight request.
 */
const filePreviewCache = new Map<string, { at: number; promise: Promise<Blob> }>();
const FILE_PREVIEW_TTL_MS = 10 * 60_000;
/** Bump when server-side preview HTML/CSS changes so in-session cache is not stale. */
const FILE_PREVIEW_CACHE_VERSION = 4;

/** Drop every cached preview. Called on logout so blobs don't leak across sessions. */
export function clearFilePreviewCache(): void {
  filePreviewCache.clear();
}

/**
 * Fetch the watermarked preview for a stored file by its `s3Key`. The endpoint
 * streams raw file bytes (image/PDF), so we request it as a `Blob` and let the
 * caller turn it into an object URL for rendering.
 */
export const getFilePreview = (key: string): Promise<Blob> => {
  const cacheKey = `${FILE_PREVIEW_CACHE_VERSION}:${key}`;
  const hit = filePreviewCache.get(cacheKey);
  if (hit && Date.now() - hit.at < FILE_PREVIEW_TTL_MS) return hit.promise;

  const promise = api
    .get(API_ENDPOINTS.FILE_PREVIEW, { params: { key: key }, responseType: "blob" })
    .then((res) => {
      const blob = res.data as Blob;
      // Axios sometimes leaves blob.type empty even when the server sent a Content-Type
      // (needed to distinguish PDF vs watermarked HTML for .docx). Copy it over.
      const headerType = String(res.headers["content-type"] ?? "").split(";")[0].trim();
      if (headerType && (!blob.type || blob.type === "application/octet-stream")) {
        return new Blob([blob], { type: headerType });
      }
      return blob;
    })
    .catch((err) => {
      // Never cache a failure — the hook's error state must stay retryable.
      if (filePreviewCache.get(cacheKey)?.promise === promise) filePreviewCache.delete(cacheKey);
      throw err;
    });

  filePreviewCache.set(cacheKey, { at: Date.now(), promise });
  return promise;
};

/**
 * Fetch the stored original file (not the HTML preview conversion used for Word/Excel).
 * Used by the preview modal Download button so .docx / .xlsx / .pptx save as those formats.
 */
export const getOriginalFile = (key: string): Promise<Blob> =>
  api
    .get(API_ENDPOINTS.FILE_PREVIEW, {
      params: { key, download: "1" },
      responseType: "blob",
    })
    .then((res) => {
      const blob = res.data as Blob;
      const headerType = String(res.headers["content-type"] ?? "").split(";")[0].trim();
      if (headerType && (!blob.type || blob.type === "application/octet-stream" || blob.type.startsWith("text/html"))) {
        return new Blob([blob], { type: headerType });
      }
      return blob;
    });

/**
 * Fetch the submitted KYC documents for the authenticated company along with the
 * submission/expiry timestamps (verification-status step). Some backends wrap the
 * payload in `{ data: … }`; we unwrap that case so callers always get the flat
 * response body.
 */
export const getKycDocs = (): Promise<GetKycDocsResponse> =>
  api.get<GetKycDocsResponse | { data: GetKycDocsResponse }>(API_ENDPOINTS.GET_KYC_DOCS).then((res) => {
    const body = res.data as GetKycDocsResponse & { data?: GetKycDocsResponse };
    return body.data ?? body;
  });
