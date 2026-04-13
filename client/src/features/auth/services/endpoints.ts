/** Same host as the SPA (e.g. `http://localhost:5000/Api/...`) — ASP.NET-style routes. */
const API = "/Api";

export const AUTH_ENDPOINTS = {
  TOKEN: `${API}/Authentication/Token`,
  GET_SOCIAL_LOGIN_ENDPOINT: `${API}/Authentication/GetSocialLogInEndPoint`,
  GET_LOGIN_OPTIONS: `${API}/Authentication/GetLoginOptions`,
} as const;

export const MFA_ENDPOINTS = {
  RESEND_OTP: `${API}/Mfa/ResendOtp`,
} as const;

export const IAM_ENDPOINTS = {
  GET_SIGNUP_SETTING: `${API}/Iam/GetSignUpSetting`,
  /** Current session user (profile image, name, etc.) — same as `@blocks-idp/iam` `getUser()`. */
  GET_USER: `${API}/Iam/GetUser`,
} as const;

export const IDENTIFIER_ENDPOINTS = {
  SIGNUP: `${API}/People/Signup`,
} as const;
