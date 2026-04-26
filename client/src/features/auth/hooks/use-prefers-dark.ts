import { useEffect, useState } from "react";

/** Best-effort dark mode for SSO icons when `next-themes` is not available. */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    if (el.classList.contains("dark")) {
      setDark(true);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const fn = () => setDark(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  return dark;
}
