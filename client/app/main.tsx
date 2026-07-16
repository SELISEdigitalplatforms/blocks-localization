import "@seliseblocks/blocks-kit/lib";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import { Toaster } from "./components/ui-kits/toaster/toaster";
import QueryProvider from "./providers/query-provider";
import { router } from "./router";
import { BlocksAppLayout } from "@seliseblocks/blocks-kit";
import { ThemeProvider } from "@seliseblocks/blocks-kit/providers";
import { TooltipProvider } from "./components/ui-kits/tooltip/tooltip";
import "./styles/globals.css";

const darkLogoUrl = "/localization_logo_white.svg";
const lightLogoUrl = "/localization_logo_black.svg";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <NuqsAdapter>
        <ThemeProvider>
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
        </ThemeProvider>
      </NuqsAdapter>
    </QueryProvider>
  </StrictMode>,
);
