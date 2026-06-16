import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from "@microsoft/signalr";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { deriveLogicBaseUrl } from "@/lib/blocks-url.util";
import { http } from "@/lib/http-client";

export class NotificationClientService {
  public connection: HubConnection;
  private connectPromise: Promise<void> | null = null;

  constructor() {
    this.connection = this.createConnection();
  }

  private createConnection() {
    const logicApiBaseUrl = deriveLogicBaseUrl();
    const xBlocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");

    const connection = new HubConnectionBuilder()
      .withUrl(
        `${logicApiBaseUrl}/api/NotificationHub?x-blocks-key=${xBlocksKey}`,
        {
          transport: HttpTransportType.WebSockets,
          skipNegotiation: true,
          withCredentials: true,
        },
      )
      .withAutomaticReconnect()
      .build();

    connection.onclose(() => {
      this.connectPromise = null;
    });

    return connection;
  }

  async connect() {
    if (
      this.connection.state === HubConnectionState.Connected ||
      this.connection.state === HubConnectionState.Connecting ||
      this.connection.state === HubConnectionState.Reconnecting
    ) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      await http.refreshSession();
      await this.connection.start();
    })().catch((error) => {
      this.connectPromise = null;
      throw error;
    });

    return this.connectPromise;
  }

  async disconnect() {
    if (this.connection.state !== HubConnectionState.Disconnected) {
      await this.connection.stop();
    }
    this.connectPromise = null;
  }
}

export const notificationClientService = new NotificationClientService();
