import { getRuntimeEnv } from "../lib/runtime-env";

export const API_BASES = {
  COMMUNICATION: "/api",
  CLOUD_CONFIGURATION: "/api",
  UDS: "/api",
  UILM: "/api",
  UTILITIES: "/api",
  CLOUD_BUILD: "/api",
  IAM: getRuntimeEnv("BLOCKS_IAM_BASE_URL") + "/api",
  /** @deprecated Use API_BASES.IAM instead. Kept as an alias for backward compatibility. */
  IDP: getRuntimeEnv("BLOCKS_IAM_BASE_URL") + "/api",
  IDENTIFIER: "/api",
  LMT: "/api",
  MFA: "/api",
  ALERT: "/api",
  AI: "/api",
  STUDIO: "/api",
  LOGIC: getRuntimeEnv("BLOCKS_LOGIC_BASE_URL") + "/api",
} as const;
