"use client";

import { useFilePreview } from "@/lib/useFilePreview";

/**
 * Stored keys are paths (`company/<companyId>/<userId>/profile/<ts>-name.jpg`). Older
 * rows hold just the picked file's name ("profile.jpg") from before the photo was
 * actually uploaded — those resolve to nothing, so treat them as "no photo" rather than
 * firing a request that 404s. Those users need to re-upload their picture.
 */
const isStorageKey = (v?: string | null) => !!v && v.includes("/");

/**
 * Renders a stored profile picture, falling back to whatever initials avatar the call
 * site already had.
 *
 * `profile_photo` holds a storage key (S3 or Azure Blob depending on the
 * `aws_service_enabled` flag), not a URL — so the bytes come back through
 * `/file/file-preview`, which serves profile keys un-watermarked. While that request is
 * in flight, or if there's no photo / it fails to load, `children` is shown instead.
 * Keeping the fallback as children means every avatar keeps its own shape, size and
 * role-tinted gradient without this component knowing about any of them.
 */
export function Avatar({
  photoKey,
  alt,
  className = "",
  style,
  children,
}: {
  /** The stored key from `profile_photo`. Null/empty renders the fallback. */
  photoKey?: string | null;
  alt: string;
  /** Applied to the <img> — pass the same size/shape classes the fallback uses. */
  className?: string;
  /** For call sites that size their avatar inline rather than with classes. */
  style?: React.CSSProperties;
  /** The existing initials avatar, shown whenever there's no image to display. */
  children: React.ReactNode;
}) {
  const key = isStorageKey(photoKey?.trim()) ? photoKey! : null;
  const { url, isPdf } = useFilePreview(key);

  if (!url || isPdf) return <>{children}</>;
  // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, not an optimizable asset
  return <img src={url} alt={alt} className={`object-cover ${className}`} style={style} />;
}
