import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
} from "@microsoft/signalr";
import { getRuntimeEnv } from "@/lib/runtime-env";

const UTILITY_API_BASE_URL = "https://dev-utility.blocksdevelopers.com";

export class NotificationClientService {
  public connection: HubConnection;

  constructor() {
    const xBlocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");

    this.connection = new HubConnectionBuilder()
      .withUrl(
        `${UTILITY_API_BASE_URL}/NotificationHub?x-blocks-key=${xBlocksKey}`,
        {
          transport: HttpTransportType.WebSockets,
        },
      )
      .withAutomaticReconnect()
      .build();
    this.connect();
  }

  async connect() {
    this.connection.start();
  }

  async disconnect() {
    if (this.connection.state !== "Disconnected") {
      await this.connection.stop();
    }
  }
}

export const notificationClientService = new NotificationClientService();
