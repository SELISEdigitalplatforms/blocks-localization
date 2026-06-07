import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import { Toaster } from "./components/ui-kits/toaster/toaster";
import QueryProvider from "./providers/query-provider";
import { router } from "./router";
import { BlocksAppLayout } from '@seliseblocks/blocks-kit'
import { TooltipProvider } from "./components/ui-kits/tooltip/tooltip";
import "./styles/globals.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <NuqsAdapter>
        <TooltipProvider>
          <BlocksAppLayout
            config={{
              userBaseUrlKey: 'BLOCKS_IAM_BASE_URL',
              projectBaseUrlKey: 'BLOCKS_LOCALIZATION_BASE_URL',
            }}
          >
            <RouterProvider router={router} />
          </BlocksAppLayout>
          <Toaster />
        </TooltipProvider>
      </NuqsAdapter>
    </QueryProvider>
  </StrictMode>,
)
