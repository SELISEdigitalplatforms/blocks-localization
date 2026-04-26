import { publicAsset } from "@/lib/public-asset";
import { Cloud, Server } from "lucide-react";
import type { ReactNode } from "react";

type DocCardProps = {
  label: string;
  description: string;
  url: string;
  imageUri?: string;
  illustration?: ReactNode;
};

function CloudIllustration() {
  return (
    <div
      className="mx-auto flex h-[188px] w-[188px] max-w-full shrink-0 flex-col items-center justify-center"
      aria-hidden
    >
      <div className="relative flex items-center justify-center">
        <Cloud className="h-[4.5rem] w-[4.5rem] text-sky-500/85 sm:h-20 sm:w-20" strokeWidth={1.15} />
        <Server className="absolute bottom-[0.35rem] left-1/2 h-9 w-9 -translate-x-1/2 text-primary/90" strokeWidth={1.35} />
      </div>
    </div>
  );
}

function DocCard({ label, imageUri, description, url, illustration }: DocCardProps) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block min-w-0">
      <div className="flex min-w-0 flex-col gap-3">
        <h4 className="m-0 block text-xl font-semibold sm:hidden">{label}</h4>

        <div className="flex max-w-2xl items-center justify-center rounded border bg-card">
          <div className="my-5 text-center sm:my-6">
            {illustration ? (
              illustration
            ) : imageUri ? (
              <img
                src={publicAsset(imageUri)}
                width={188}
                height={188}
                alt=""
                className="mx-auto h-auto max-h-[188px] w-auto max-w-full object-contain"
              />
            ) : null}
          </div>
        </div>
        <h4 className="m-0 hidden text-xl font-semibold sm:block">{label}</h4>
        <div className="text-base font-normal text-high-emphasis">{description}</div>
      </div>
    </a>
  );
}

const DOC_ITEMS: Array<{
  label: string;
  description: string;
  url: string;
  imageUri?: string;
}> = [
  {
    label: "Docs",
    description:
      "Established standards that help project managers and technical leaders minimize project risks.",
    imageUri: "assets/images/console/console_timeline.png",
    url: "https://github.com/SELISEdigitalplatforms/Wiki-BlocksGuideline-Code/wiki",
  },
  {
    label: "Code",
    description:
      "A repository of well-documented, reusable, tried and tested core components for developers.",
    imageUri: "assets/images/console/console_coding.png",
    url: "https://github.com/SELISEdigitalplatforms",
  },
  {
    label: "Cloud",
    description: "High-performing, optimized, and 24/7 monitored enterprise cloud deployment.",
    url: "https://selisegroup.com/blocks/",
  },
];

export function DefaultDocStrip() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {DOC_ITEMS.map((item) => (
        <DocCard
          key={item.label}
          label={item.label}
          description={item.description}
          url={item.url}
          imageUri={item.imageUri}
          illustration={item.label === "Cloud" ? <CloudIllustration /> : undefined}
        />
      ))}
    </div>
  );
}
