import { http } from "@/lib/http-client";
import {
  INotification,
  INotificationConfig,
} from "@blocks-utilities/notification/models/notification.model";
import {
  NOTIFICATION_CONFIG_ENDPOINTS,
  NOTIFICATION_ENDPOINTS,
} from "@blocks-utilities/notification/constants/endpoint.constant";

const UTILITY_API_BASE = "https://dev-utility.blocksdevelopers.com/api";

export class NotificationService {
  getNotifications = (
    pageNumber: number,
    pageSize: number,
  ): Promise<{
    unReadNotificationsCount: number;
    totalNotificationsCount: number;
    notifications: INotification[];
  }> => {
    const url = `${UTILITY_API_BASE}/Notifier/GetNotifications?page=${pageNumber - 1}&pageSize=${pageSize}`;
    return http.get(url, undefined, { absoluteUrl: true });
  };

  markAsRead = (
    notificationId: string,
  ): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    return http.post(`${UTILITY_API_BASE}/Notifier/MarkNotificationAsRead`, {
      id: notificationId,
    }, undefined, { absoluteUrl: true });
  };

  markAllNotificationsAsRead = (): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    return http.post(`${UTILITY_API_BASE}/Notifier/MarkAllNotificationAsRead`, {}, undefined, { absoluteUrl: true });
  };

  getNotificationConfig = (
    config: INotificationConfig,
    message: string,
  ): void => {
    const notificationEvent = new CustomEvent(config.notifyMethod, {
      detail: {
        method: config.notifyMethod,
        message: message,
        timestamp: new Date().toISOString(),
        config: config,
      },
    });
    window.dispatchEvent(notificationEvent);
  };

  getNotificationConfigs = (
    page: number = 0,
    pageSize: number = 10,
    projectKey: string,
  ): Promise<{
    configurations: INotificationConfig[];
    totalCount: number;
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = `${UTILITY_API_BASE}/Notification/Gets?page=${page}&pageSize=${pageSize}&projectKey=${projectKey}`;
    return http.get(url, undefined, { absoluteUrl: true });
  };

  saveNotificationConfig = (payload: {
    name: string;
    channelToNotify: number;
    notificationType: number;
    enablePersistence: boolean;
    notifyMethod: string;
    projectKey: string;
    isUpdateRequest: boolean;
    itemId?: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    return http.post(`${UTILITY_API_BASE}/Notification/Save`, payload, undefined, { absoluteUrl: true });
  };

  deleteNotificationConfig = (payload: {
    itemId: string;
    projectKey: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = `${UTILITY_API_BASE}/Notification/Delete?itemId=${payload.itemId}&projectKey=${payload.projectKey}`;
    return http.delete(url, undefined, { absoluteUrl: true });
  };
}

export const notificationService = new NotificationService();
