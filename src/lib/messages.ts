/**
 * Centralized user-facing message strings, so copy stays consistent across pages
 * and is edited in one place. Import these instead of inlining string literals.
 */

/** Error / fallback messages surfaced to the user (toasts, inline `apiError`, thrown errors). */
export const ERROR_MESSAGES = {
  /** A flow reported success but returned no auth tokens — treat as a failed session. */
  NO_SESSION: "Your session couldn't be started. Please try again.",
  LOGIN_FAILED: "Login failed. Please check your credentials.",
  REGISTRATION_FAILED: "Registration failed. Please try again.",
  RESET_PASSWORD_FAILED: "Couldn't reset your password. Please try again.",
  INVALID_OTP: "The code you entered is invalid or has expired.",
  /** Couldn't fetch the active-session limit status after OTP verification. */
  SESSION_LIMIT_FETCH_FAILED: "Couldn't check active sessions. Please try again.",
  /** Revoking the selected sessions failed (generic fallback; backend message takes priority). */
  SESSION_REVOKE_FAILED: "Couldn't log out the selected session(s). Please try again.",
  /** GSTIN failed the sandbox.co.in check (generic fallback; backend message takes priority). */
  GST_VERIFICATION_FAILED: "GSTIN could not be verified. Please check the number and try again.",
  /** CIN failed the verification check (generic fallback; backend message takes priority). */
  CIN_VERIFICATION_FAILED: "CIN could not be verified. Please check the number and try again.",
} as const;

/**
 * How users reach a human (the suspended-account screen, and anywhere else that needs the
 * desk). PLACEHOLDER address — override per environment with NEXT_PUBLIC_SUPPORT_EMAIL, or
 * replace the fallback here once the real desk is live.
 */
export const SUPPORT = {
  EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@bridgeconnect.com",
} as const;

/** Success messages surfaced to the user (toasts). */
export const SUCCESS_MESSAGES = {
  LOGIN: "Welcome back.",
  REGISTRATION: "Registration successful.",
  RESET_PASSWORD_OTP_SENT: "We've sent a one-time code to your email.",
  RESET_PASSWORD_SUCCESS: "Password reset successfully. Please sign in.",
  GST_VERIFIED: "GSTIN verified successfully.",
  CIN_VERIFIED: "CIN verified successfully.",
} as const;