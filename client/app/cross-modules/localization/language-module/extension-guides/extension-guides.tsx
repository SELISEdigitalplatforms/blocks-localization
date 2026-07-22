import React from "react";
import { FileText, ExternalLink, Server, Cloud, Settings } from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Card } from "@/components/ui-kits/card/card";

const EXTENSION_WEBSTORE_URL =
  "https://chromewebstore.google.com/detail/selise-blocks-assistant/ehnhmdghlkaeaiinoahgipdeogkikjem";

const blocksInstances = [
  {
    icon: Cloud,
    name: "Blocks Cloud (V1)",
    description:
      "Legacy Blocks Cloud instance for existing projects. Configure using the IAM base URL.",
    configKey: "BLOCKS_IAM_BASE_URL",
    configExample: "https://blocks-cloud.example.com",
  },
  {
    icon: Server,
    name: "Blocks OS (V4)",
    description:
      "Next-generation Blocks platform with enhanced features. Configure using the OS base URL.",
    configKey: "BLOCKS_OS_BASE_URL",
    configExample: "https://blocks-os.example.com",
  },
];

const setupSteps = [
  {
    step: 1,
    title: "Install the Extension",
    description:
      "Add the Blocks Localization extension to your browser from the Chrome Web Store",
  },
  {
    step: 2,
    title: "Configure Blocks Instance",
    description:
      "Set up your Blocks instance URL in the extension settings (Blocks Cloud V1 or Blocks OS V4)",
  },
  {
    step: 3,
    title: "Authenticate",
    description:
      "Sign in with your Blocks account credentials to connect the extension to your project",
  },
  {
    step: 4,
    title: "Start Managing Translations",
    description:
      "Use the extension dashboard to add, edit, and manage translation keys across all languages",
  },
];

export const ExtensionGuides: React.FC = () => {
  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb />

      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Extension Guides</h1>
      </div>

      <div className="grid gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
          <div className="space-y-4">
            {setupSteps.map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Blocks Instances</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The Blocks Localization extension supports connecting to different
            Blocks instances. Choose the instance that matches your project
            setup.
          </p>
          <div className="space-y-4">
            {blocksInstances.map((instance) => (
              <div
                key={instance.name}
                className="flex gap-4 p-4 border rounded-lg"
              >
                <instance.icon className="h-6 w-6 shrink-0 text-primary mt-1" />
                <div>
                  <h3 className="font-medium">{instance.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {instance.description}
                  </p>
                  <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
                    <div className="text-muted-foreground">
                      Environment Variable:
                    </div>
                    <div>{instance.configKey}</div>
                    <div className="text-muted-foreground mt-2">Example:</div>
                    <div>{instance.configExample}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Details
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium">Blocks Cloud (V1)</h3>
              <p className="text-muted-foreground mt-1">
                Uses{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  BLOCKS_IAM_BASE_URL
                </code>{" "}
                for authentication and API calls. This is the legacy Blocks
                platform that has been serving existing projects.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Blocks OS (V4)</h3>
              <p className="text-muted-foreground mt-1">
                Uses{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  BLOCKS_OS_BASE_URL
                </code>{" "}
                for authentication and API calls. This is the next-generation
                Blocks platform with enhanced features and improved performance.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Browser Extension</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Get the Blocks Localization extension for Chrome to manage
            translations directly from your browser.
          </p>
          <a
            href={EXTENSION_WEBSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Get the Extension from Chrome Web Store
          </a>
        </Card>
      </div>
    </div>
  );
};
