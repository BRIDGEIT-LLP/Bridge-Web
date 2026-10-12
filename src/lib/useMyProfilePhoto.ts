"use client";

import { useEffect, useState } from "react";
import { getUserProfile, type ProfileField } from "@/services/user.service";

/** The `user` column holding the logged-in user's profile-picture storage key. */
const PROFILE_PHOTO_COLUMN = "profile_photo";

/** Pull the profile-photo key out of a profile-fields response (null when absent). */
export function profilePhotoKey(fields: ProfileField[]): string | null {
  const field = fields.find((f) => f.columnName === PROFILE_PHOTO_COLUMN);
  return typeof field?.value === "string" && field.value.trim() ? field.value : null;
}

/**
 * The CURRENT user's profile-picture key, for the places that show *their own*
 * avatar (sidebar, My Profile header).
 *
 * Sourced from `GET /api/v1/users/profile` — the session doesn't carry the photo —
 * via the module-cached `getUserProfile()`, so mounting this in several places costs
 * a single request per session. Returns null while loading, on failure, or when the
 * user has no picture; every call site keeps its existing fallback avatar for that.
 *
 * Pass `enabled: false` (e.g. for staff roles, which have no user profile) to skip
 * the request entirely.
 */
export function useMyProfilePhoto(enabled = true): string | null {
  const [photoKey, setPhotoKey] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getUserProfile()
      .then((res) => {
        if (active) setPhotoKey(profilePhotoKey(res.data ?? []));
      })
      .catch(() => {
        /* leave null — the call site's initials/icon fallback stays visible */
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return photoKey;
}
