import { appRouter } from "@/routing/app-router";
import { AppProviders } from "@/providers/app-providers";
import { Toaster } from "@/platform/ui";
import { RootMeta } from "@/seo/root-meta";
import { RouterProvider } from "react-router-dom";

import "@/styles/globals.css";

export function App() {
  return (
    <AppProviders>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <RootMeta />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <RouterProvider router={appRouter} />
        </div>
        <Toaster />
      </div>
    </AppProviders>
  );
}
