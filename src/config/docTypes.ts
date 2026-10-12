/**
 * Document-type identifiers sent to the scan API (`docType`) so the backend knows
 * which document each uploaded file represents. Aadhaar additionally carries a
 * `side` (front/back). Keep these strings in sync with the backend's expected values.
 */
export const DOC_TYPE = {
  AADHAAR: "AADHAAR",
  PAN: "PAN",
  PITCH_DECK: "PITCH_DECK",
  INCORPORATION_CERTIFICATE: "INCORPORATION_CERTIFICATE",
  /** Optional intro video — the backend files videos under `intro-video/`. */
  INTRO_VIDEO: "INTRO_VIDEO",
  /** Not a KYC document — the backend files anything outside KYC_DOC_TYPES under `profile/`. */
  PROFILE_PHOTO: "PROFILE_PHOTO",
} as const;

export type DocType = (typeof DOC_TYPE)[keyof typeof DOC_TYPE];
export const DOC_MAX_MB: Record<DocType, number> = {
  AADHAAR: 5,
  PAN: 5,
  PROFILE_PHOTO: 5,
  INTRO_VIDEO: 30,
  PITCH_DECK: 20,
  INCORPORATION_CERTIFICATE: 20,
};

/** Which face of a two-sided document (Aadhaar) is being uploaded. */
export type DocSide = "front" | "back";
