import { expect, type APIResponse, type Page, type Request } from "@playwright/test";
import { openTranslations } from "./localization-helpers";

/**
 * `E2E_LARGE_FIXTURES=1` turns on the tests that seed more than 10,000 keys (the bulk-action cap).
 * They take several minutes to seed and clean up, so they are skipped by default.
 */
export function largeFixturesEnabled(): boolean {
  return process.env.E2E_LARGE_FIXTURES === "1";
}

/** Fixed-width key names, so names sort in creation order and none is a prefix of another. */
export function fixtureKeyName(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(5, "0")}`;
}

export interface ApiKeyRow {
  itemId: string;
  keyName: string;
  moduleId?: string;
}

/** The Key/Gets filter fields the bulk endpoints accept as `filter`. */
export interface KeyListFilter {
  moduleIds: string[];
  searchKey?: string;
  sortProperty?: string;
  isDescending?: boolean;
  isPartiallyTranslated?: boolean;
}

export interface BulkKeyActionBody {
  isSuccess?: boolean;
  matchedCount?: number | null;
  errors?: Record<string, string> | null;
}

const isKeyGetsUrl = (url: string) => /\/Key\/Gets(\?|$)/.test(url);

// Seeding and module deletion touch thousands of keys in one request.
const LONG_REQUEST_MS = 300_000;

/**
 * Direct calls to the localization API with the headers the app itself sends, for seeding and
 * removing large per-run key fixtures. Every write is scoped to a module this run created.
 */
export class BulkKeyApi {
  private constructor(
    readonly page: Page,
    readonly base: string,
    readonly headers: Record<string, string>,
  ) {}

  /** Opens Translations and takes the API base and headers from the app's own Key/Gets request. */
  static async capture(page: Page): Promise<BulkKeyApi> {
    const listRequest = page.waitForRequest(
      (r) => isKeyGetsUrl(r.url()) && r.method() === "POST",
      { timeout: 30_000 },
    );
    await openTranslations(page);
    const request: Request = await listRequest;
    const headers = Object.fromEntries(
      Object.entries(await request.allHeaders()).filter(
        ([name]) =>
          // HTTP/2 pseudo-headers (":authority", ":path", ...) are not valid request header names.
          !name.startsWith(":") &&
          !["content-length", "host", "cookie", "connection", "accept-encoding"].includes(
            name.toLowerCase(),
          ),
      ),
    );
    return new BulkKeyApi(page, request.url().replace(/\/Key\/Gets(\?.*)?$/, ""), headers);
  }

  private async json<T>(response: APIResponse, what: string): Promise<T> {
    expect(response.ok(), `${what}: HTTP ${response.status()}`).toBe(true);
    return (await response.json()) as T;
  }

  async defaultCulture(): Promise<string> {
    const languages = await this.json<{ languageCode: string; isDefault: boolean }[]>(
      await this.page.request.get(`${this.base}/Language/GetLanguagesForCurrentTenant`, {
        headers: this.headers,
      }),
      "list languages",
    );
    const language = languages.find((l) => l.isDefault) ?? languages[0];
    expect(language, "the test project needs a language").toBeTruthy();
    return language.languageCode;
  }

  async createModule(moduleName: string): Promise<string> {
    await this.json(
      await this.page.request.post(`${this.base}/Module/Save`, {
        headers: this.headers,
        data: { moduleName },
      }),
      `create module ${moduleName}`,
    );
    const modules = await this.json<{ itemId: string; moduleName: string }[]>(
      await this.page.request.get(`${this.base}/Module/GetModulesForCurrentTenant?_=${Date.now()}`, {
        headers: this.headers,
      }),
      "list modules",
    );
    const created = modules.find((module) => module.moduleName === moduleName);
    expect(created, `module ${moduleName} is listed`).toBeTruthy();
    return created!.itemId;
  }

  /**
   * Creates keys `{prefix}-{start}` … `{prefix}-{start + count - 1}` in the module through
   * Key/SaveKeys, a few batches at a time. SaveKeys upserts by name and module, so a failed batch
   * is retried as is.
   */
  async seedKeys(
    moduleId: string,
    prefix: string,
    count: number,
    culture: string,
    { start = 1, batchSize = 250, concurrency = 4 } = {},
  ): Promise<void> {
    const batches: number[][] = [];
    for (let offset = 0; offset < count; offset += batchSize) {
      const size = Math.min(batchSize, count - offset);
      batches.push(Array.from({ length: size }, (_, i) => start + offset + i));
    }

    const saveBatch = async (indexes: number[]) => {
      const data = indexes.map((index) => {
        const value = `Fixture value ${index}`;
        return {
          keyName: fixtureKeyName(prefix, index),
          moduleId,
          isNewKey: false,
          isPartiallyTranslated: false,
          routes: [],
          context: "",
          glossaryIds: [],
          resources: [{ culture, value, characterLength: value.length }],
        };
      });
      let lastError = "";
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await this.page.request
          .post(`${this.base}/Key/SaveKeys`, {
            headers: this.headers,
            data,
            timeout: LONG_REQUEST_MS,
          })
          .catch((error: Error) => error);
        if (!(response instanceof Error) && response.ok()) {
          const body = (await response.json()) as { success?: boolean; errorMessage?: string };
          if (body.success) return;
          lastError = body.errorMessage ?? "SaveKeys reported failure";
        } else {
          lastError =
            response instanceof Error ? response.message : `HTTP ${response.status()}`;
        }
      }
      throw new Error(`Seeding ${indexes.length} keys into ${moduleId} failed: ${lastError}`);
    };

    let next = 0;
    const worker = async () => {
      while (next < batches.length) {
        const batch = batches[next];
        next += 1;
        await saveBatch(batch);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
  }

  async countKeys(moduleId: string): Promise<number> {
    const body = await this.json<{ totalCount: number | null }>(
      await this.page.request.post(`${this.base}/Key/Gets`, {
        headers: this.headers,
        data: {
          pageNumber: 0,
          pageSize: 1,
          moduleIds: [moduleId],
          sortProperty: "KeyName",
          isDescending: false,
          includeTotalCount: true,
        },
      }),
      "count keys",
    );
    return body.totalCount ?? 0;
  }

  /** Every key of the module, through the keyset cursor. */
  async listKeys(moduleId: string): Promise<ApiKeyRow[]> {
    const rows: ApiKeyRow[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 1_000; page += 1) {
      const body = await this.json<{ keys: ApiKeyRow[]; nextCursor?: string | null }>(
        await this.page.request.post(`${this.base}/Key/Gets`, {
          headers: this.headers,
          data: {
            pageNumber: 0,
            pageSize: 1_000,
            moduleIds: [moduleId],
            sortProperty: "KeyName",
            isDescending: false,
            includeTotalCount: false,
            cursor,
          },
          timeout: LONG_REQUEST_MS,
        }),
        "list keys",
      );
      rows.push(...body.keys);
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    // Never act on a row outside the module, whatever the filter returned.
    return rows.filter((row) => !row.moduleId || row.moduleId === moduleId);
  }

  async findKeyId(moduleId: string, keyName: string): Promise<string> {
    const body = await this.json<{ keys: ApiKeyRow[] }>(
      await this.page.request.post(`${this.base}/Key/Gets`, {
        headers: this.headers,
        data: {
          pageNumber: 0,
          pageSize: 10,
          searchKey: keyName,
          moduleIds: [moduleId],
          sortProperty: "KeyName",
          isDescending: false,
        },
      }),
      "search keys",
    );
    const key = body.keys.find((k) => k.keyName === keyName);
    expect(key, `key ${keyName} is listed`).toBeTruthy();
    return key!.itemId;
  }

  /** Key/DeleteKeys with any body; the caller checks the status (the bulk endpoints answer 4xx on purpose). */
  async deleteKeysRaw(body: Record<string, unknown>): Promise<APIResponse> {
    return this.page.request.delete(`${this.base}/Key/DeleteKeys`, {
      headers: this.headers,
      data: body,
      timeout: LONG_REQUEST_MS,
    });
  }

  /**
   * Deletes the module with its keys. If the cascading delete fails, the module's keys are listed
   * and deleted by ID (at most 10,000 per request), then the module is deleted again.
   */
  async removeModule(moduleId: string): Promise<void> {
    const deleteModule = () =>
      this.page.request
        .delete(
          `${this.base}/Module/Delete?itemId=${encodeURIComponent(moduleId)}&deleteKeys=true`,
          { headers: this.headers, timeout: LONG_REQUEST_MS },
        )
        .catch(() => null);

    const first = await deleteModule();
    if (first?.ok()) return;

    const ids = (await this.listKeys(moduleId)).map((row) => row.itemId);
    for (let offset = 0; offset < ids.length; offset += 10_000) {
      await this.deleteKeysRaw({ itemIds: ids.slice(offset, offset + 10_000) });
    }
    const second = await deleteModule();
    expect(second?.ok(), `cleanup of module ${moduleId}`).toBe(true);
  }
}
