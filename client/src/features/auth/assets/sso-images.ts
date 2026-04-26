import { publicAsset } from "@/lib/public-asset";
import { SSO_PROVIDERS } from "@/features/auth/model/types";

const p = (relative: string) => publicAsset(relative);

/** Public URLs (from `client/public`, respects Vite `base`). */
export const SSO_IMAGE_PATHS: Record<
  SSO_PROVIDERS,
  { light: string; dark?: string }
> = {
  [SSO_PROVIDERS.github]: {
    light: p("assets/images/social-media-github.png"),
    dark: p("assets/images/github-dark-mode.png"),
  },
  [SSO_PROVIDERS.google]: { light: p("assets/images/social-media-google.png") },
  [SSO_PROVIDERS.microsoft]: { light: p("assets/images/social-media-ms.png") },
  [SSO_PROVIDERS.linkedin]: { light: p("assets/images/social-media-in.png") },
  [SSO_PROVIDERS.x]: {
    light: p("assets/images/twitter-x-light-mode-logo.png"),
    dark: p("assets/images/twitter-x-dark-mode-logo.png"),
  },
  [SSO_PROVIDERS.apple]: {
    light: p("assets/images/social-media-apple.png"),
    dark: p("assets/images/apple-dark-mode-logo.png"),
  },
  [SSO_PROVIDERS.facebook]: { light: p("assets/images/social-media-facebook.png") },
  [SSO_PROVIDERS.ownsso]: { light: p("assets/images/selise-globe-logo.png") },
};
