import { publicAsset } from "@/lib/public-asset";
import { cn } from "@/platform/ui/lib/cn";
import { Link } from "react-router-dom";

type LogoBandProps = {
  className?: string;
  showRightBorder?: boolean;
  /** Collapsed sidebar: icon mark only (`SmoothLogoTransition` collapsed in Next). */
  variant?: "wordmark" | "icon";
};

/** Matches `SmoothLogoTransition` from the Next app — wordmark or icon SVG, theme-aware. */
export function LogoBand({ className, showRightBorder, variant = "wordmark" }: LogoBandProps) {
  const isIcon = variant === "icon";

  return (
    <div
      className={cn(
        "ml-2 flex h-full items-center",
        isIcon ? "w-10 justify-center !ml-0" : "w-57",
        showRightBorder && "border-r border-po-sidebar-border",
        className,
      )}
    >
      <Link
        to="/console"
        className={cn(
          "relative inline-flex h-9 shrink-0 items-center",
          isIcon ? "w-9 justify-center" : "max-w-50",
        )}
        aria-label="SELISE Blocks"
      >
        {isIcon ? (
          <>
            <img
              src={publicAsset("Icon.svg")}
              alt=""
              className="h-8 w-8 object-contain dark:hidden"
            />
            <img
              src={publicAsset("Icon_White.svg")}
              alt=""
              className="hidden h-8 w-8 object-contain dark:block"
            />
          </>
        ) : (
          <>
            <img
              src={publicAsset("Logo.svg")}
              alt=""
              className="h-9 w-auto max-w-full object-contain object-left dark:hidden"
            />
            <img
              src={publicAsset("Logo_White.svg")}
              alt=""
              className="hidden h-9 w-auto max-w-full object-contain object-left dark:block"
            />
          </>
        )}
      </Link>
    </div>
  );
}
