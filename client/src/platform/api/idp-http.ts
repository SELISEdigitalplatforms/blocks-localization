import { useAuthStore } from "@/features/auth/model/auth-store";
import { AUTH_ENDPOINTS } from "@/features/auth/services/endpoints";
import { env } from "@/config/env";
import { getQueryClient } from "@/platform/query/query-client-holder";

export class HttpError extends Error {
  readonly status: number;
  readonly errors: Record<string, string | string[]>;

  constructor(status: number, errors: Record<string, string | string[]>) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.errors = errors;
  }
}

export type IdpRequestOptions = {
  /** When true, a 401 is not treated as “try refresh”; use for pre-session TOKEN grants (password / SSO). */
  skipTokenRotation?: boolean;
};

function joinBase(path: string): string {
  const base = env.apiBaseUrl.replace(/\/$/, "");
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorsFromBody(body: unknown, status: number): Record<string, string | string[]> {
  let errors: Record<string, string | string[]> = {};
  if (body && typeof body === "object" && body !== null) {
    const o = body as Record<string, unknown>;
    if ("errors" in o && typeof o.errors === "object" && o.errors !== null) {
      errors = o.errors as Record<string, string | string[]>;
    } else {
      errors = o as Record<string, string | string[]>;
    }
  }
  if (Object.keys(errors).length === 0) {
    errors = { message: typeof body === "string" ? body : `HTTP ${status}` };
  }
  return errors;
}

type Queued = {
  path: string;
  init: RequestInit;
  options: IdpRequestOptions;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

let isRefreshing = false;
let requestQueue: Queued[] = [];

/** Clears refresh coordinator state (Vitest only). */
export function resetIdpHttpStateForTests(): void {
  isRefreshing = false;
  requestQueue = [];
}

/** Matches `src/lib/http-client.ts` refresh body for backend parity. */
async function refreshAccessToken(): Promise<boolean> {
  const formData = new URLSearchParams();
  formData.append("grant_type", "refresh_token");
  formData.append("refresh_token", `""`);
  const url = joinBase(AUTH_ENDPOINTS.TOKEN);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (env.xBlocksKey) headers["X-Blocks-Key"] = env.xBlocksKey;
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });
  return response.ok;
}

function handleRefreshFailure(): void {
  useAuthStore.getState().reset();
  const queryClient = getQueryClient();
  if (queryClient) {
    void queryClient.cancelQueries();
    queryClient.clear();
  }
  try {
    window.location.href = "/login";
  } catch {
    /* jsdom does not implement navigation; real browsers succeed here */
  }
}

async function runRefreshAndReplay(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const ok = await refreshAccessToken();
    if (!ok) {
      throw new Error("Failed to refresh token");
    }
    while (requestQueue.length > 0) {
      const { path, init, options, resolve, reject } = requestQueue.shift()!;
      idpRequestInner(path, init, options).then(resolve).catch(reject);
    }
  } catch {
    handleRefreshFailure();
  } finally {
    isRefreshing = false;
    requestQueue = [];
  }
}

async function idpRequestInner<T>(
  path: string,
  init: RequestInit = {},
  options: IdpRequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (env.xBlocksKey) headers.set("X-Blocks-Key", env.xBlocksKey);

  const res = await fetch(joinBase(path), {
    ...init,
    headers,
    credentials: "include",
  });
  const body = await readBody(res);

  if (res.status === 401 && !options.skipTokenRotation) {
    return new Promise<T>((resolve, reject) => {
      requestQueue.push({
        path,
        init,
        options,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void runRefreshAndReplay();
    });
  }

  if (!res.ok) {
    throw new HttpError(res.status, errorsFromBody(body, res.status));
  }
  return body as T;
}

export async function idpRequest<T>(
  path: string,
  init: RequestInit = {},
  options: IdpRequestOptions = {},
): Promise<T> {
  return idpRequestInner<T>(path, init, options);
}

export function idpGet<T>(path: string, options?: IdpRequestOptions) {
  return idpRequest<T>(path, { method: "GET" }, options);
}

export function idpPostFormUrlEncoded<T>(
  path: string,
  params: URLSearchParams,
  options?: IdpRequestOptions,
) {
  return idpRequest<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    options,
  );
}

export function idpPostJson<T>(path: string, json: unknown, options?: IdpRequestOptions) {
  return idpRequest<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    },
    options,
  );
}

export function idpDelete<T>(path: string, options?: IdpRequestOptions) {
  return idpRequest<T>(path, { method: "DELETE" }, options);
}
