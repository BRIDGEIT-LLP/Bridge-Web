import { api, type ApiError } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import { toRoleCode } from "@/lib/roles";
import type {
  RegisterPayload,
  RegisterResponse,
  VerifyGstPayload,
  VerifyGstResponse,
  VerifyCinPayload,
  VerifyCinResponse,
  LoginPayload,
  LoginResponse,
  SelectChannelPayload,
  SelectChannelResponse,
  VerifyMfaOtpPayload,
  VerifyMfaOtpResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
  ResendOtpPayload,
  ResendOtpResponse,
  SwitchRolePayload,
  SwitchRoleResponse,
  SwitchRoleDetailsResponse,
  RequestRoleSwitchResponse,
  ResetPasswordTriggerOtpPayload,
  ResetPasswordTriggerOtpResponse,
  ResetPasswordVerifyOtpPayload,
  ResetPasswordVerifyOtpResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
} from "@/types/api.types";

/** Which login portal a request targets — selects the endpoint group below. */
export type Portal = "user" | "admin" | "superadmin";

const AUTH_BY_PORTAL: Record<Portal, { LOGIN: string; MFA_SELECT_CHANNEL: string; MFA_VERIFY_OTP: string }> = {
  user: {
    LOGIN: API_ENDPOINTS.LOGIN,
    MFA_SELECT_CHANNEL: API_ENDPOINTS.MFA_SELECT_CHANNEL,
    MFA_VERIFY_OTP: API_ENDPOINTS.MFA_VERIFY_OTP,
  },
  admin: {
    LOGIN: API_ENDPOINTS.ADMIN_LOGIN,
    MFA_SELECT_CHANNEL: API_ENDPOINTS.ADMIN_MFA_SELECT_CHANNEL,
    MFA_VERIFY_OTP: API_ENDPOINTS.ADMIN_MFA_VERIFY_OTP,
  },
  superadmin: {
    LOGIN: API_ENDPOINTS.SUPERADMIN_LOGIN,
    MFA_SELECT_CHANNEL: API_ENDPOINTS.SUPERADMIN_MFA_SELECT_CHANNEL,
    MFA_VERIFY_OTP: API_ENDPOINTS.SUPERADMIN_MFA_VERIFY_OTP,
  },
};

const LEGACY_BACKEND_ERROR: ApiError = {
  message: "This app version isn't compatible with the connected server. Please contact support.",
};

/**
 * Detects the pre-cookie-migration response shape (tokens returned in the body). Tokens
 * are httpOnly cookies now — the backend sets them directly on the response and the body
 * no longer carries them. If a mismatched/older backend still returns them in the body,
 * the call still looks like a 2xx success but no cookie ever arrives, so the very next
 * authenticated request fails and the app bounces back to login with no clear reason why.
 * This catches that at the source instead.
 */
function assertNotLegacyTokenResponse(data: unknown): void {
  if (data && typeof data === "object" && ("accessToken" in data || "refreshToken" in data)) {
    throw LEGACY_BACKEND_ERROR;
  }
}

/**
 * Register the company (step 1).
 *
 * NOTE: This is the single place to update when the real curl is provided —
 * swap the method/URL/body/headers here. Everything else stays the same.
 */
export async function registerCompany(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>(API_ENDPOINTS.REGISTER, payload);
  assertNotLegacyTokenResponse(data.data);
  return data;
}

/**
 * Check a GSTIN against sandbox.co.in — called when the GST field on the
 * registration form loses focus, ahead of the full submit. The same check is
 * re-run server-side inside company-registration, so this is purely for the
 * live ✓ Verified / error feedback while the user is still filling the form.
 */
export async function verifyGst(payload: VerifyGstPayload): Promise<VerifyGstResponse> {
  const { data } = await api.post<VerifyGstResponse>(API_ENDPOINTS.VERIFY_GST, payload);
  return data;
}

/**
 * Check a CIN — mirrors verifyGst above. Currently backed by a fixed mock
 * response on the backend pending full validation of the live CIN API.
 */
export async function verifyCin(payload: VerifyCinPayload): Promise<VerifyCinResponse> {
  const { data } = await api.post<VerifyCinResponse>(API_ENDPOINTS.VERIFY_CIN, payload);
  return data;
}

/**
 * Log in an existing user with email + password.
 *
 * The `portal` selects which backend endpoint group to hit (user / admin /
 * superadmin) — all three share this identical payload + response shape.
 * NOTE: swap the method/URL/body/headers here when the real curl is provided.
 */
export async function loginUser(payload: LoginPayload, portal: Portal = "user"): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(AUTH_BY_PORTAL[portal].LOGIN, payload);
  assertNotLegacyTokenResponse(data.data);
  return data;
}

/**
 * Login MFA: send the chosen channel (EMAIL | PHONE) to the backend, which then
 * triggers the OTP send over that channel. `portal` selects the endpoint group.
 * NOTE: swap the method/URL/body/headers here when the real curl is provided.
 */
export async function selectMfaChannel(
  payload: SelectChannelPayload,
  portal: Portal = "user",
): Promise<SelectChannelResponse> {
  const { data } = await api.post<SelectChannelResponse>(AUTH_BY_PORTAL[portal].MFA_SELECT_CHANNEL, payload);
  return data;
}

/**
 * Login MFA: verify the OTP the user entered for the chosen channel. `portal`
 * selects the endpoint group.
 * NOTE: swap the method/URL/body/headers here when the real curl is provided.
 */
export async function verifyMfaOtp(
  payload: VerifyMfaOtpPayload,
  portal: Portal = "user",
): Promise<VerifyMfaOtpResponse> {
  const { data } = await api.post<VerifyMfaOtpResponse>(AUTH_BY_PORTAL[portal].MFA_VERIFY_OTP, payload);
  assertNotLegacyTokenResponse(data.data);
  return data;
}

/**
 * Password reset — step 1: trigger an OTP to the account email. No auth needed.
 */
export async function triggerResetPasswordOtp(
  payload: ResetPasswordTriggerOtpPayload,
): Promise<ResetPasswordTriggerOtpResponse> {
  const { data } = await api.post<ResetPasswordTriggerOtpResponse>(
    API_ENDPOINTS.RESET_PASSWORD_TRIGGER_OTP,
    payload,
  );
  return data;
}

/**
 * Password reset — step 2: verify the emailed OTP. The response carries a short-
 * lived reset access token; the caller persists it (via setTokens) so the axios
 * interceptor authorizes the step-3 reset call.
 */
export async function verifyResetPasswordOtp(
  payload: ResetPasswordVerifyOtpPayload,
): Promise<ResetPasswordVerifyOtpResponse> {
  const { data } = await api.post<ResetPasswordVerifyOtpResponse>(
    API_ENDPOINTS.RESET_PASSWORD_VERIFY_OTP,
    payload,
  );
  assertNotLegacyTokenResponse(data.data);
  return data;
}

/**
 * Password reset — step 3: set the new password. Authorization is the reset
 * access token from step 2, attached automatically by the request interceptor
 * (stored via setTokens), so no manual header is needed here.
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
  const { data } = await api.post<ResetPasswordResponse>(API_ENDPOINTS.RESET_PASSWORD, payload);
  return data;
}

/**
 * Preview the target role's registration fields (filled and unfilled) without
 * creating a company_user_role row.
 */
export async function getSwitchRoleDetails(payload: SwitchRolePayload): Promise<SwitchRoleDetailsResponse> {
  const { data } = await api.get<SwitchRoleDetailsResponse>(API_ENDPOINTS.SWITCH_ROLE_DETAILS, {
    params: { roleCode: toRoleCode(payload.role) },
  });
  return data;
}

/**
 * Save the target role's profile fields and create a pending company_user_role
 * with is_profile_completed=true. Does not re-issue session tokens.
 */
export async function requestRoleSwitch(
  payload: SwitchRolePayload & Record<string, unknown>,
): Promise<RequestRoleSwitchResponse> {
  const { role, ...profileFields } = payload;
  const { data } = await api.post<RequestRoleSwitchResponse>(API_ENDPOINTS.REQUEST_ROLE_SWITCH, {
    roleCode: toRoleCode(role),
    ...profileFields,
  });
  return data;
}

/**
 * Switch the active user role.
 *
 * The backend takes `roleCode` in its own uppercase enum (STARTUP / INVESTOR / B2B) —
 * not our lowercase `Role` — so the mapping happens here rather than at every call site.
 *
 * Only an already-approved role is switched. On success the re-issued token pair is
 * set as httpOnly cookies on the response. When the role still needs admin approval,
 * or was rejected, the backend answers `success: false` at HTTP 200 — see
 * SwitchRoleResponse; the caller must check `success` because axios will not throw.
 */
export async function switchRole(payload: SwitchRolePayload): Promise<SwitchRoleResponse> {
  const { data } = await api.post<SwitchRoleResponse>(API_ENDPOINTS.SWITCH_ROLE, {
    roleCode: toRoleCode(payload.role),
  });
  return data;
}

/**
 * Verify the mobile OTP (step 2).
 * NOTE: swap the method/URL/body/headers here when the real curl is provided.
 */
export async function verifyMobileOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  const { data } = await api.post<VerifyOtpResponse>(API_ENDPOINTS.VERIFY_MOBILE_OTP, payload);
  return data;
}

/**
 * Verify the email OTP (step 2).
 * NOTE: swap the method/URL/body/headers here when the real curl is provided.
 */
export async function verifyEmailOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  const { data } = await api.post<VerifyOtpResponse>(API_ENDPOINTS.VERIFY_EMAIL_OTP, payload);
  return data;
}

/**
 * Request a fresh OTP for a channel (mobile or email).
 * NOTE: swap the method/URL/body/headers here when the real curl is provided.
 */
export async function resendOtp(payload: ResendOtpPayload): Promise<ResendOtpResponse> {
  const { data } = await api.post<ResendOtpResponse>(API_ENDPOINTS.RESEND_OTP, payload);
  return data;
}
