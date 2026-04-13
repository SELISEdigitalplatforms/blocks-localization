import { useEffect, useState } from "react";

const QUERY = "(max-width: 639px)";

function readMobileMatch(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Matches Tailwind `sm` (640px): true when viewport is **below** `sm` — same breakpoint as `sm:hidden` / mobile sheet.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(readMobileMatch);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
