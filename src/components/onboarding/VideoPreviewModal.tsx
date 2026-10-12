"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/modal/Modal";
import { Loader } from "@/components/common/loader";
import { getIntroVideoUrl, type IntroVideoTarget } from "@/services/file.service";
import type { ApiError } from "@/lib/axios";

interface VideoPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Whose video to play. Omit for the signed-in user's own saved video. */
  target?: IntroVideoTarget;
  /** Play a just-picked local file (object URL) instead of fetching the saved one. */
  localUrl?: string | null;
}

/**
 * Modal player for an intro video. Saved videos are streamed from a short-lived signed
 * URL that is requested each time the modal opens (so a stale link never plays). There
 * is deliberately no Download button, and the native download / picture-in-picture
 * controls are turned off — view-only, as for every other viewer.
 */
export function VideoPreviewModal({ open, onClose, title = "Intro Video", target, localUrl }: VideoPreviewModalProps) {
  const [fetched, setFetched] = useState<{ key: string; url: string | null; error: string | null } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const targetKey = target ? `${target.userId}:${target.companyId ?? ""}:${target.roleId}` : "self";
  const needsFetch = open && !localUrl;
  // Re-fetch on every open: the URL expires after a few minutes.
  const requestKey = needsFetch ? `${targetKey}:${open}` : null;

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    getIntroVideoUrl(target)
      .then((url) => {
        if (!cancelled) setFetched({ key: requestKey!, url, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setFetched({
            key: requestKey!,
            url: null,
            error: (err as ApiError)?.message || "Couldn't load the video.",
          });
        }
      });
    return () => {
      cancelled = true;
      setFetched(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsFetch, targetKey]);

  // Stop playback (and audio) as soon as the modal closes.
  const handleClose = () => {
    videoRef.current?.pause();
    onClose();
  };

  const current = fetched && fetched.key === requestKey ? fetched : null;
  const src = localUrl ?? current?.url ?? null;
  const loading = needsFetch && !current;
  const error = current?.error ?? null;

  return (
    <Modal open={open} onClose={handleClose} title={title} overlayZClass="z-[60]" overlayZ={60} maxWidthClass="max-w-3xl">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader size="large" className="text-primary" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <Icon name="error" size={32} className="text-error" />
          <span className="text-sm font-medium text-error">{error}</span>
        </div>
      ) : src ? (
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          playsInline
          preload="metadata"
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="mx-auto max-h-[70vh] w-full rounded-lg bg-black"
        />
      ) : null}
    </Modal>
  );
}
