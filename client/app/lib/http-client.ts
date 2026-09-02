import { getRuntimeEnv } from "@/lib/runtime-env";
import { HttpClient } from "@seliseblocks/genesis-os/lib";
import { createHttpFailureReporter, getRollbar } from "@seliseblocks/genesis-os/observability";
import { SERVICE_NAME } from "@/constants/service.constant";

// Only failures that never reached the server -- API unreachable, DNS, CORS, TLS.
const onError = createHttpFailureReporter(getRollbar({ service: SERVICE_NAME }));

export const serviceInstances = {
  localizationService: new HttpClient({
    baseURL: getRuntimeEnv("BLOCKS_LOCALIZATION_BASE_URL") || "",
    blocksKey: getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
    onError,
  }),
  logicService: new HttpClient({
    baseURL: getRuntimeEnv("BLOCKS_LOGIC_BASE_URL") || "",
    blocksKey: getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
    onError,
  }),
  iamService: new HttpClient({
    baseURL: getRuntimeEnv("BLOCKS_IAM_BASE_URL") || "",
    blocksKey: getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
    onError,
  }),
};

export { HttpClient };
