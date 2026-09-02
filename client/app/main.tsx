import "@seliseblocks/genesis-os/lib";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { Toaster } from "./components/ui-kits/toaster/toaster";
import QueryProvider, { getQueryClient } from "./providers/query-provider";
import { router } from "./router";
import { BlocksAppLayout, ThemeProvider } from "@seliseblocks/genesis-os/providers";
import {
  RollbarProvider,
  attachQueryErrorReporting,
  getRollbar,
} from "@seliseblocks/genesis-os/observability";
import { TooltipProvider } from "./components/ui-kits/tooltip/tooltip";
import { SERVICE_NAME } from "./constants/service.constant";
import "./styles/globals.css";

const darkLogoUrl = "/localization_logo_white.svg";
const lightLogoUrl = "/localization_logo_black.svg";

// This app builds its own QueryClient (see query-provider.tsx), so the reporter must be
// wired explicitly -- RollbarProvider only instruments the package's shared client.
attachQueryErrorReporting(getQueryClient(), getRollbar({ service: SERVICE_NAME }));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RollbarProvider service={SERVICE_NAME}>
      <QueryProvider>
        <ThemeProvider>
          <NuqsAdapter>
            <TooltipProvider>
              <BlocksAppLayout
                config={{
                  appLogoUrl: {
                    dark: darkLogoUrl,
                    light: lightLogoUrl,
                  },
                  name: "blocks-localization",
                }}
              >
                <RouterProvider router={router} />
              </BlocksAppLayout>
              <Toaster />
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </QueryProvider>
    </RollbarProvider>
  </StrictMode>,
);
