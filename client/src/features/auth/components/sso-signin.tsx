import { cn } from "@/platform/ui/lib/cn";
import type { LoginOption } from "@/features/auth/model/types";
import { SSO_PROVIDERS } from "@/features/auth/model/types";
import { SsoSigninCard } from "@/features/auth/components/sso-signin-card";

const GRID_COLS_MAP: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

const PROVIDER_META: Record<
  SSO_PROVIDERS,
  { label: string; isAvailable: boolean }
> = {
  [SSO_PROVIDERS.github]: { label: "GitHub", isAvailable: true },
  [SSO_PROVIDERS.google]: { label: "Google", isAvailable: true },
  [SSO_PROVIDERS.microsoft]: { label: "Microsoft", isAvailable: true },
  [SSO_PROVIDERS.linkedin]: { label: "LinkedIn", isAvailable: true },
  [SSO_PROVIDERS.x]: { label: "X", isAvailable: true },
  [SSO_PROVIDERS.apple]: { label: "Apple", isAvailable: true },
  [SSO_PROVIDERS.facebook]: { label: "Facebook", isAvailable: false },
  [SSO_PROVIDERS.ownsso]: { label: "SELISE", isAvailable: true },
};

type SsoSigninProps = {
  loginOption: LoginOption;
};

export function SsoSignin({ loginOption }: SsoSigninProps) {
  const providers = Object.entries(PROVIDER_META)
    .map(([key, meta]) => {
      const providerEnum = key as SSO_PROVIDERS;
      if (!meta.isAvailable) return null;
      const sso = loginOption?.ssoInfo?.find((s) => s.provider === providerEnum);
      if (!sso) return null;
      return {
        provider: providerEnum,
        audience: sso.audience,
        label: meta.label,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);

  const gridColsClass = GRID_COLS_MAP[Math.min(providers.length, 5)];

  return (
    <div className={cn("grid gap-2", providers.length > 2 && gridColsClass)}>
      {providers.map((item) => (
        <SsoSigninCard
          key={item.provider}
          provider={item.provider}
          audience={item.audience}
          label={item.label}
          withLabel={providers.length < 3}
        />
      ))}
    </div>
  );
}
