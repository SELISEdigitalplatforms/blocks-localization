import { Button } from "@/platform/ui/components/button/button";
import { BookOpenText } from "lucide-react";
import { env } from "@/config/env";
import { publicAsset } from "@/lib/public-asset";

export function BlockInfo() {
  const constructUrl = env.constructUrl || "https://construct.seliseblocks.com";

  return (
    <div className="mt-6 w-full p-4 shadow-none md:p-0 lg:mt-0 lg:max-w-md">
      <div className="mb-9 flex items-center gap-4">
        <a href="https://docs.seliseblocks.com/" target="_blank" rel="noreferrer" className="w-full">
          <Button type="button" variant="outline" className="w-full">
            <BookOpenText className="mr-3 h-4 w-4" />
            See Docs
          </Button>
        </a>
      </div>
      <div className="mb-9 flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Frontend</h2>
        <div className="flex items-center gap-4">
          <div className="flex w-[50%] flex-col gap-2">
            <Button type="button" variant="outline" className="w-full">
              <img src={publicAsset("assets/images/react-icon.png")} width={20} height={20} alt="React logo" />
            </Button>
            <div className="flex items-center gap-2 text-blue-700 md:justify-between">
              <a className="text-primary" href="https://www.npmjs.com/package/@seliseblocks/cli" target="_blank" rel="noreferrer">
                Npm
              </a>
              <span className="h-4 w-px bg-gray-300" />
              <a
                className="text-primary"
                href="https://github.com/SELISEdigitalplatforms/l3-react-blocks-construct"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <span className="h-4 w-px bg-gray-300" />
              <a className="text-primary" href={constructUrl} target="_blank" rel="noreferrer">
                Demo
              </a>
            </div>
          </div>
          <div className="flex w-[50%] flex-col gap-2">
            <Button type="button" variant="outline" className="w-full" disabled>
              <img src={publicAsset("assets/images/angular-icon.png")} width={20} height={20} alt="Angular logo" />
            </Button>
            <p className="text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>
      <div className="mb-[36px] flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Backend</h2>
        <div className="flex items-center gap-4">
          <div className="flex w-[50%] flex-col gap-2">
            <Button type="button" variant="outline" className="w-full">
              <img src={publicAsset("assets/images/dotnet-icon.png")} width={20} height={20} alt=".NET logo" />
            </Button>
            <div className="flex items-center gap-1 text-blue-700 md:justify-between">
              <a className="text-primary" href="https://www.nuget.org/profiles/SELISE" target="_blank" rel="noreferrer">
                NuGet
              </a>
              <span className="h-4 w-[0.5px] bg-gray-300" />
              <a
                className="text-primary"
                href="https://github.com/SELISEdigitalplatforms/l0-net-blocks-construct"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <span className="h-4 w-[0.5px] bg-gray-300" />
              <a className="text-primary" href="https://pypi.org/project/seliseblocks-lmt/" target="_blank" rel="noreferrer">
                PyPI
              </a>
            </div>
          </div>
          <div className="flex w-[50%] flex-col gap-2">
            <Button type="button" variant="outline" className="w-full" disabled>
              <img src={publicAsset("assets/images/ruby-icon.png")} width={20} height={20} alt="Ruby logo" />
            </Button>
            <p className="text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-center">Fully open source.</p>
        <a href="https://github.com/SELISEdigitalplatforms" target="_blank" rel="noreferrer">
          <Button type="button" variant="outline" className="w-full">
            <img
              src={publicAsset("assets/images/social-media-github.png")}
              width={20}
              height={20}
              className="mr-3"
              alt="GitHub logo"
            />
            Open in GitHub
          </Button>
        </a>
      </div>
    </div>
  );
}
