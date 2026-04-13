import { useEffect, useState } from "react";

/** Matches `src/hooks/use-count-down.ts` in the main app (used by MFA resend cooldown). */
export function useCountDown(initialSeconds: number) {
  const [remainingTime, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (remainingTime <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingTime]);

  const reset = (time?: number) => {
    setSecondsLeft(time ?? initialSeconds);
  };

  return {
    remainingTime,
    reset,
  };
}
