import { useIamCurrentUser } from "@/features/auth/hooks/use-iam-current-user";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { env } from "@/config/env";
import { useEffect, useState } from "react";

/**
 * Parity with monolith `src/providers/chatbot-embedder.tsx`: loads `${WIDGET_URL}/embed.js`
 * and syncs theme + optional user logo with `window.SeliseBlocksChatbot`.
 *
 * Requires root `.env`: `NEXT_PUBLIC_WIDGET_URL` / `NEXT_PUBLIC_WIDGET_ID` (or `VITE_*` equivalents).
 * The vendor script draws the floating launcher + chat panel (not the project-overview sidebar).
 * If URL or id is missing, `BlocksChatbotFallbackLauncher` in `App.tsx` shows a matching blue FAB + toast instead of rendering nothing.
 */

const SCRIPT_MARKER = "data-selise-blocks-chatbot-loader";

export function BlocksChatbotEmbed() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [widgetReady, setWidgetReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.SeliseBlocksChatbot),
  );
  const { data: iamRes } = useIamCurrentUser();

  useEffect(() => {
    if (!isAuthenticated || !env.widgetUrl || !env.widgetId) return;

    const markReady = (): void => {
      if (window.SeliseBlocksChatbot) setWidgetReady(true);
    };

    const widgetUrl = env.widgetUrl.replace(/\/$/, "");
    const existing = document.querySelector(`script[${SCRIPT_MARKER}]`) as HTMLScriptElement | null;

    if (existing) {
      markReady();
      if (!window.SeliseBlocksChatbot) {
        existing.addEventListener("load", markReady);
        return () => existing.removeEventListener("load", markReady);
      }
      return undefined;
    }

    const script = document.createElement("script");
    script.setAttribute(SCRIPT_MARKER, "true");
    script.src = `${widgetUrl}/embed.js`;
    script.async = true;
    script.setAttribute("data-widget-id", env.widgetId);
    script.setAttribute("data-widget-type", "chat");
    script.setAttribute("data-project-key", env.xBlocksKey);
    script.setAttribute("data-app-domain", env.appUrl);
    script.setAttribute("data-app-mode", env.appEnv);
    script.setAttribute("data-chat-width", "400px");
    script.setAttribute("data-chat-height", "550px");
    script.setAttribute("data-chat-left", "20px");
    script.setAttribute("data-button-left", "20px");
    script.addEventListener("load", markReady);
    document.body.appendChild(script);
    return () => script.removeEventListener("load", markReady);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!widgetReady || !window.SeliseBlocksChatbot) return;
    const url = iamRes?.data?.profileImageUrl?.trim();
    if (url) {
      window.SeliseBlocksChatbot.emit({
        type: "updateData",
        data: { userLogoUrl: url },
      });
    }
  }, [iamRes?.data?.profileImageUrl, widgetReady]);

  useEffect(() => {
    if (!widgetReady || !window.SeliseBlocksChatbot) return;
    if (!isAuthenticated) {
      window.SeliseBlocksChatbot.emit({
        type: "updateData",
        data: { userLogoUrl: "" },
      });
    }
  }, [isAuthenticated, widgetReady]);

  useEffect(() => {
    if (!widgetReady || !window.SeliseBlocksChatbot) return;

    const applyTheme = (): void => {
      const api = window.SeliseBlocksChatbot;
      if (!api) return;
      const dark = document.documentElement.classList.contains("dark");
      if (dark) {
        api.emit({
          type: "updateData",
          data: {
            designSettings: {
              headerStartColor: "#ced2d4",
              headerEndColor: "#83a4ec",
              titleColor: "#fff",
              chatBackgroundColor: "#1f2029",
              chatFontColor: "#eee",
              sendButtonBackgroundColor: "#444",
              sendButtonFontColor: "#fff",
              chatButtonBgColor: "#2C599D",
              borderColor: "#444",
            },
          },
        });
      } else {
        api.emit({
          type: "updateData",
          data: { designSettings: null },
        });
      }
    };

    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [widgetReady]);

  return null;
}
