import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type ForwardedRef,
} from "react";

export type ReCaptchaWidgetRef = {
  reset: () => void;
};

type ReCaptchaProps = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  theme?: "light" | "dark";
  size?: "normal" | "compact";
};

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        params: {
          sitekey: string;
          size: "compact" | "normal";
          theme: "light" | "dark";
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => number;
      ready: (cb: () => void) => void;
      reset: (widgetId?: number) => void;
    };
  }
}

const SCRIPT_ID = "uilm-recaptcha-script";
const SCRIPT_SRC = "https://www.google.com/recaptcha/api.js?render=explicit";

const isReady = () => typeof window !== "undefined" && !!window.grecaptcha;

export const ReCaptcha = forwardRef(function ReCaptcha(
  { siteKey, theme = "light", onVerify, onExpired, onError, size = "normal" }: ReCaptchaProps,
  ref: ForwardedRef<ReCaptchaWidgetRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    },
  }));

  const renderReCaptcha = useCallback(() => {
    if (!containerRef.current || !window.grecaptcha) return;
    window.grecaptcha.ready(() => {
      if (widgetIdRef.current !== null) return;
      widgetIdRef.current = window.grecaptcha!.render(containerRef.current!, {
        sitekey: siteKey,
        theme,
        size,
        callback: onVerify,
        ...(onExpired ? { "expired-callback": onExpired } : {}),
        ...(onError ? { "error-callback": onError } : {}),
      });
    });
  }, [siteKey, theme, size, onVerify, onExpired, onError]);

  useEffect(() => {
    if (isReady()) {
      renderReCaptcha();
      return;
    }

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const scriptNode = document.getElementById(SCRIPT_ID);
    scriptNode?.addEventListener("load", renderReCaptcha);

    return () => {
      scriptNode?.removeEventListener("load", renderReCaptcha);
    };
  }, [renderReCaptcha]);

  return <div ref={containerRef} />;
});
