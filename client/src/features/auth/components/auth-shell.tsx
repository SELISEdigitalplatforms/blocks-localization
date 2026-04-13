import type { ReactNode } from "react";
import { BlockInfo } from "@/features/auth/components/blocks-info";
import { publicAsset } from "@/lib/public-asset";
import { useEffect, useState } from "react";

type AuthShellProps = {
  children: ReactNode;
};

/**
 * Wordmark must follow the *document* theme class (`html.dark`), not OS `prefers-color-scheme`,
 * so we never show Logo_White on a still-light auth shell (invisible logo).
 */
export function useBrandedLogoSrc(): string {
  const [src, setSrc] = useState(() =>
    document.documentElement.classList.contains("dark")
      ? publicAsset("Logo_White.svg")
      : publicAsset("Logo.svg"),
  );

  useEffect(() => {
    const el = document.documentElement;
    const update = () => {
      setSrc(publicAsset(el.classList.contains("dark") ? "Logo_White.svg" : "Logo.svg"));
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return src;
}

export function AuthShell({ children }: AuthShellProps) {
  const logoSrc = useBrandedLogoSrc();

  return (
    <div className="thin-scrollbar flex min-h-full w-full flex-col items-center overflow-y-auto overscroll-y-contain py-[24px] lg:py-[64px] xl:px-[154px]">
      <div className="flex w-full items-center justify-center">
        <img
          src={logoSrc}
          width={128}
          height={55}
          alt="SELISE Blocks logo"
          className="h-13.75 w-auto max-w-[min(100%,200px)] object-contain"
        />
      </div>
      <div className="mt-5 flex w-full flex-col justify-center gap-0 md:px-6 lg:mt-17.5 lg:flex-row lg:gap-20 lg:px-0 2xl:mt-[80px]">
        <div>{children}</div>
        <BlockInfo />
      </div>
    </div>
  );
}
