import { useEffect } from "react";

/**
 * Subscribes to `window` CustomEvents named `notificationName` (same contract as
 * `@blocks-communication/notification/hooks/use-notification-listener`).
 */
export function useNotificationListener(
  notificationName: string,
  callback: (data: unknown) => void,
): void {
  useEffect(() => {
    const handleNotification = (event: Event) => {
      callback((event as CustomEvent).detail);
    };

    window.addEventListener(notificationName, handleNotification as EventListener);

    return () => {
      window.removeEventListener(notificationName, handleNotification as EventListener);
    };
  }, [callback, notificationName]);
}
