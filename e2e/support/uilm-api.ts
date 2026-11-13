import { randomUUID, createHash } from "node:crypto";
import { expect, request, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { BulkKeyApi } from "./bulk-key-api";
import { openProjectRoute } from "./localization-helpers";

/** One manifest entry (GetUilmManifest, spec 4 §6). */
export interface UilmManifestEntry {
  moduleName: string;
  language: string;
  url: string | null;
  hash: string | null;
  size: number | null;
  version: number | null;
}

export interface UilmManifest {
  version: number;
  files: UilmManifestEntry[];
}

// The worker publishes asynchronously after GenerateUilmFile; give it time to write the pointer.
const PUBLISH_TIMEOUT_MS = 180_000;

export const sha256Hex = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Strips the quotes (and a weak prefix) from an ETag header value. */
export const etagValue = (etag: string | undefined) => (etag ?? "").replace(/^W\//, "").replace(/"/g, "");

/**
 * The UILM read endpoints as an anonymous client sees them (project key only, no session), plus the
 * authenticated calls the specs need to set up their own module: save a key, publish, run maintenance.
 * Every write is scoped to a module the calling test created.
 */
export class UilmApi {
  private constructor(
    readonly keys: BulkKeyApi,
    readonly anonymous: APIRequestContext,
    private readonly projectKey: string,
  ) {}

  /**
   * Copies the project's X-Blocks-Key from the dashboard, as a client developer would, then opens
   * Translations to take the API base and session headers from the app. The app's own `x-blocks-key`
   * header is the service's key, not the project's, so it cannot stand in for a client.
   */
  static async open(page: Page): Promise<UilmApi> {
    await openProjectRoute(page, "dashboard");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const keyRow = page.getByText("X-Blocks-Key", { exact: true }).locator("..");
    await keyRow.getByRole("button").click();
    let projectKey = "";
    await expect
      .poll(async () => (projectKey = (await page.evaluate(() => navigator.clipboard.readText())).trim()), {
        timeout: 15_000,
      })
      .toMatch(/^\w{20,}$/);

    const keys = await BulkKeyApi.capture(page);
    const anonymous = await request.newContext({ ignoreHTTPSErrors: true });
    return new UilmApi(keys, anonymous, projectKey);
  }

  get base() {
    return this.keys.base;
  }

  async dispose() {
    await this.anonymous.dispose();
  }

  private anonymousHeaders(options: { ifNoneMatch?: string; projectKey?: string | null } = {}) {
    const headers: Record<string, string> = {};
    const key = options.projectKey === undefined ? this.projectKey : options.projectKey;
    if (key) headers["x-blocks-key"] = key;
    if (options.ifNoneMatch) headers["if-none-match"] = options.ifNoneMatch;
    return headers;
  }

  getFile(
    moduleName: string,
    language: string,
    options: { ifNoneMatch?: string; projectKey?: string | null } = {},
  ): Promise<APIResponse> {
    const query = new URLSearchParams({ Language: language, ModuleName: moduleName });
    return this.anonymous.get(`${this.base}/Key/GetUilmFile?${query}`, {
      headers: this.anonymousHeaders(options),
    });
  }

  getManifest(
    filter: { moduleName?: string; language?: string } = {},
    options: { ifNoneMatch?: string; projectKey?: string | null } = {},
  ): Promise<APIResponse> {
    const query = new URLSearchParams();
    if (filter.moduleName !== undefined) query.set("ModuleName", filter.moduleName);
    if (filter.language !== undefined) query.set("Language", filter.language);
    const suffix = query.toString() ? `?${query}` : "";
    return this.anonymous.get(`${this.base}/Key/GetUilmManifest${suffix}`, {
      headers: this.anonymousHeaders(options),
    });
  }

  async manifest(filter: { moduleName?: string; language?: string } = {}): Promise<UilmManifest> {
    const response = await this.getManifest(filter);
    expect(response.status(), "GetUilmManifest status").toBe(200);
    return (await response.json()) as UilmManifest;
  }

  /** The tenant's languages, default first. */
  async languages(): Promise<string[]> {
    const response = await this.keys.page.request.get(
      `${this.base}/Language/GetLanguagesForCurrentTenant?_=${Date.now()}`,
      { headers: this.keys.headers },
    );
    expect(response.ok(), `list languages: HTTP ${response.status()}`).toBe(true);
    const languages = (await response.json()) as { languageCode: string; isDefault: boolean }[];
    expect(languages.length, "the test project needs a language").toBeGreaterThan(0);
    return [...languages]
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      .map((language) => language.languageCode);
  }

  /** Creates or updates one key with a value in one language, without publishing. */
  async saveKey(moduleId: string, keyName: string, culture: string, value: string) {
    const response = await this.keys.page.request.post(`${this.base}/Key/SaveKeys`, {
      headers: this.keys.headers,
      data: [
        {
          keyName,
          moduleId,
          isNewKey: false,
          isPartiallyTranslated: false,
          routes: [],
          context: "",
          glossaryIds: [],
          resources: [{ culture, value, characterLength: value.length }],
        },
      ],
    });
    expect(response.ok(), `save key ${keyName}: HTTP ${response.status()}`).toBe(true);
    const body = (await response.json()) as { success?: boolean; errorMessage?: string };
    expect(body.success, body.errorMessage ?? "SaveKeys reported failure").toBe(true);
  }

  /** Queues a publish of one module, as the Publish button does. */
  async publish(moduleId: string, forceUpload = false) {
    const response = await this.keys.page.request.post(`${this.base}/Key/GenerateUilmFile`, {
      headers: this.keys.headers,
      data: { guid: randomUUID(), moduleId, forceUpload },
    });
    expect(response.ok(), `publish ${moduleId}: HTTP ${response.status()}`).toBe(true);
  }

  runMaintenance(body?: Record<string, unknown>): Promise<APIResponse> {
    return this.keys.page.request.post(`${this.base}/Key/RunUilmMaintenance`, {
      headers: this.keys.headers,
      ...(body ? { data: body } : {}),
    });
  }

  /** Waits until the published file of the module and language parses to an object with `keyName` = `value`. */
  async waitForPublishedValue(moduleName: string, language: string, keyName: string, value: string) {
    await expect
      .poll(
        async () => {
          const response = await this.getFile(moduleName, language);
          if (response.status() !== 200) return `HTTP ${response.status()}`;
          const text = await response.text();
          if (!text) return "empty body";
          try {
            return (JSON.parse(text) as Record<string, unknown>)[keyName] ?? "key missing";
          } catch {
            return "not JSON";
          }
        },
        { timeout: PUBLISH_TIMEOUT_MS, intervals: [2_000, 5_000] },
      )
      .toBe(value);
  }

  /** Waits until the manifest entry of the module and language has a Storage URL with this file's hash. */
  async waitForManifestEntry(moduleName: string, language: string, hash: string) {
    let entry: UilmManifestEntry | undefined;
    await expect
      .poll(
        async () => {
          entry = (await this.manifest({ moduleName, language })).files[0];
          return entry?.hash ?? null;
        },
        { timeout: PUBLISH_TIMEOUT_MS, intervals: [2_000, 5_000] },
      )
      .toBe(hash);
    return entry!;
  }
}

/** Creates a module with one key in the default language and publishes it; removes the module afterwards. */
export async function withPublishedModule(
  api: UilmApi,
  prefix: string,
  run: (fixture: { moduleId: string; moduleName: string; keyName: string; language: string; value: string }) => Promise<void>,
) {
  const moduleName = `${prefix}-${Date.now()}`;
  const keyName = `${prefix}_key`;
  const [language] = await api.languages();
  const value = `First text ${Date.now()}`;
  const moduleId = await api.keys.createModule(moduleName);
  try {
    await api.saveKey(moduleId, keyName, language, value);
    await api.publish(moduleId);
    await api.waitForPublishedValue(moduleName, language, keyName, value);
    await run({ moduleId, moduleName, keyName, language, value });
  } finally {
    await api.keys.removeModule(moduleId);
  }
}
