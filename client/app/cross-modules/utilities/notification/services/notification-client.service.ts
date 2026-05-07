import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
} from "@microsoft/signalr";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { deriveLogicBaseUrl } from "@/lib/blocks-url.util";

const LOGIC_API_BASE_URL = deriveLogicBaseUrl();

export class NotificationClientService {
  public connection: HubConnection;

  constructor() {
    const xBlocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");

    this.connection = new HubConnectionBuilder()
      .withUrl(
        `${LOGIC_API_BASE_URL}/NotificationHub?x-blocks-key=${xBlocksKey}`,
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
