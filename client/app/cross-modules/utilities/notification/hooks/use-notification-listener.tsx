import { useEffect } from "react";

export const useNotificationListener = (
  notificationName: string,
  callback: (data: any) => void,
) => {
  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      callback(event.detail);
    };

    window.addEventListener(notificationName, handleNotification as EventListener);

    return () => {
      window.removeEventListener(notificationName, handleNotification as EventListener);
    };
  }, [callback, notificationName]);
};
