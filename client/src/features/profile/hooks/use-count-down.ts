import { useCallback, useEffect, useState } from "react";

export function useCountDown(initialSeconds: number) {
  const [remainingTime, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (remainingTime <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingTime]);

  const reset = useCallback((time?: number) => {
    setSecondsLeft(time ?? initialSeconds);
  }, [initialSeconds]);

  return { remainingTime, reset };
}
