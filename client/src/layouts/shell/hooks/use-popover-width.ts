import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Tracks the trigger button width so a Popover can match it on narrow viewports.
 */
export function usePopoverWidth(): [RefObject<HTMLButtonElement>, number | undefined] {
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (buttonRef.current) {
        setPopoverWidth(buttonRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return [buttonRef, popoverWidth];
}
