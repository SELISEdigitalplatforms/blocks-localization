import { type Page, type Locator, type Request, type Route, expect } from "@playwright/test";
import { e2eBaseUrl } from "../env";
import { openTranslations } from "../localization-helpers";
import { KeyDetailsPage } from "./key-details.page";

export { KeyDetailsPage };

export interface ProjectLanguage {
  languageName: string;
  languageCode: string;
  isDefault: boolean;
}

interface ApiKey {
  itemId: string;
  keyName: string;
  moduleId?: string;
  context?: string;
  routes?: string[];
  glossaryIds?: string[];
  resources?: { culture: string; value: string }[];
}

/** A term's translation for one language (Phase 6 structured field). */
export interface ApiGlossaryTranslation {
  language: string;
  value: string;
  forbiddenValues: string[];
}

/** One `/Glossary/Match` hit as the server returns it. */
export interface ApiGlossaryMatch {
  glossaryId: string;
  start: number;
  length: number;
  surface: string;
  term: string;
  rule: "translate" | "keep" | "forbidden";
  status: "draft" | "approved" | "deprecated";
  scope: string;
  translations: ApiGlossaryTranslation[];
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Direct calls to the localization API with the headers the app itself sends, for creating and
 * removing per-run fixtures (keys, modules, glossaries) without driving every form.
 */
export class LocalizationApi {
  private constructor(
    private readonly page: Page,
    private readonly base: string,
    private readonly headers: Record<string, string>,
  ) {}

  /** Opens Translations and takes the API base and headers from the app's own Key/Gets request. */
  static async capture(page: Page): Promise<LocalizationApi> {
    const listRequest = page.waitForRequest(
      (r) => r.url().includes("/Key/Gets") && r.method() === "POST",
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
    return new LocalizationApi(page, request.url().replace(/\/Key\/Gets(\?.*)?$/, ""), headers);
  }

  private async json<T>(response: Awaited<ReturnType<Page["request"]["get"]>>, what: string) {
    expect(response.ok(), `${what}: HTTP ${response.status()}`).toBe(true);
    return (await response.json()) as T;
  }

  async languages(): Promise<ProjectLanguage[]> {
    const response = await this.page.request.get(
      `${this.base}/Language/GetLanguagesForCurrentTenant`,
      { headers: this.headers },
    );
    return this.json<ProjectLanguage[]>(response, "list languages");
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
      await this.page.request.get(
        `${this.base}/Module/GetModulesForCurrentTenant?_=${Date.now()}`,
        {
          headers: this.headers,
        },
      ),
      "list modules",
    );
    const created = modules.find((module) => module.moduleName === moduleName);
    expect(created, `module ${moduleName} is listed`).toBeTruthy();
    return created!.itemId;
  }

  async deleteModule(itemId: string) {
    await this.page.request.delete(
      `${this.base}/Module/Delete?itemId=${encodeURIComponent(itemId)}&deleteKeys=true`,
      { headers: this.headers },
    );
  }

  /**
   * Saves a glossary: with the Phase 6 structured fields (`rule`, `status`, `translations`, ...),
   * or with an exact stored `additionalNote` as an older client would have written it.
   */
  async createGlossary(glossary: {
    name: string;
    isGlobal: boolean;
    additionalNote?: string;
    context?: string;
    moduleIds?: string[];
    rule?: "translate" | "keep" | "forbidden";
    status?: "draft" | "approved" | "deprecated";
    caseSensitive?: boolean;
    variants?: string[];
    translations?: ApiGlossaryTranslation[];
  }): Promise<string> {
    await this.json(
      await this.page.request.post(`${this.base}/Glossary/Save`, {
        headers: this.headers,
        data: {
          context: "",
          additionalNote: "",
          language: "",
          type: "",
          moduleIds: [],
          ...glossary,
        },
      }),
      `create glossary ${glossary.name}`,
    );
    const params = new URLSearchParams({
      PageNumber: "0",
      PageSize: "20",
      SearchText: escapeRegex(glossary.name),
    });
    const found = await this.json<{ items: { itemId: string; name: string }[] }>(
      await this.page.request.get(`${this.base}/Glossary/Gets?${params.toString()}`, {
        headers: this.headers,
      }),
      "search glossaries",
    );
    const created = found.items.find((item) => item.name === glossary.name);
    expect(created, `glossary ${glossary.name} is listed`).toBeTruthy();
    return created!.itemId;
  }

  /** The id of the glossary named exactly `name`, or undefined. */
  async findGlossaryId(name: string): Promise<string | undefined> {
    const params = new URLSearchParams({
      PageNumber: "0",
      PageSize: "20",
      SearchText: escapeRegex(name),
    });
    const found = await this.json<{ items: { itemId: string; name: string }[] }>(
      await this.page.request.get(`${this.base}/Glossary/Gets?${params.toString()}`, {
        headers: this.headers,
      }),
      "search glossaries",
    );
    return found.items.find((item) => item.name === name)?.itemId;
  }

  async deleteGlossary(itemId: string) {
    await this.page.request.delete(
      `${this.base}/Glossary/Delete?itemId=${encodeURIComponent(itemId)}`,
      { headers: this.headers },
    );
  }

  async createKey(key: {
    keyName: string;
    moduleId: string;
    culture: string;
    value: string;
    context?: string;
    routes?: string[];
    glossaryIds?: string[];
  }): Promise<string> {
    const body = await this.json<{ success?: boolean; errorMessage?: string }>(
      await this.page.request.post(`${this.base}/Key/Save`, {
        headers: this.headers,
        data: {
          itemId: "",
          keyName: key.keyName,
          moduleId: key.moduleId,
          isNewKey: true,
          isPartiallyTranslated: false,
          routes: key.routes ?? [],
          context: key.context ?? "",
          glossaryIds: key.glossaryIds ?? [],
          resources: [
            { culture: key.culture, value: key.value, characterLength: key.value.length },
          ],
        },
      }),
      `create key ${key.keyName}`,
    );
    expect(body.success, body.errorMessage ?? "").toBe(true);
    const created = await this.findKey(key.keyName, key.moduleId);
    expect(created, `key ${key.keyName} is listed`).toBeTruthy();
    return created!.itemId;
  }

  async findKey(keyName: string, moduleId: string): Promise<ApiKey | undefined> {
    const list = await this.json<{ keys: ApiKey[] }>(
      await this.page.request.post(`${this.base}/Key/Gets`, {
        headers: this.headers,
        data: { pageNumber: 0, pageSize: 10, searchKey: keyName, moduleIds: [moduleId] },
      }),
      "search keys",
    );
    return list.keys.find((k) => k.keyName === keyName);
  }

  async deleteKey(itemId: string) {
    await this.page.request.delete(`${this.base}/Key/Delete?itemId=${encodeURIComponent(itemId)}`, {
      headers: this.headers,
    });
  }
}

/** An applied term of a suggestion response (Phase 6). */
export interface SuggestionAppliedTerm {
  glossaryId: string;
  term: string;
  rule: "translate" | "keep" | "forbidden";
  expected?: string;
}

/** A violation of a suggestion response (Phase 6). */
export interface SuggestionViolation {
  glossaryId: string;
  term: string;
  kind: "missing-translation" | "missing-keep" | "forbidden-used";
  expected?: string;
  found?: string;
}

/**
 * A scripted reply for one GetTranslationSuggestion call: the server's content with its applied
 * terms and violations (empty when left out, as with the server flag off), or an HTTP error.
 */
export type SuggestionReply =
  | {
      content: string;
      appliedTerms?: SuggestionAppliedTerm[];
      glossaryViolations?: SuggestionViolation[];
    }
  | { status: number };

export const isTranslationSuggestionUrl = (url: URL) =>
  url.pathname.endsWith("/Assistant/GetTranslationSuggestion");

/** The removed Track A full-glossary load: Glossary/Gets?…&PageSize=500 (SPEC7 H13). */
export const isFullGlossaryPageUrl = (url: URL) =>
  url.pathname.endsWith("/Glossary/Gets") && url.searchParams.get("PageSize") === "500";

export const isGlossaryMatchUrl = (url: URL) => url.pathname.endsWith("/Glossary/Match");

/**
 * Intercepts Assistant/GetTranslationSuggestion: each call takes the next scripted reply and
 * its request body is recorded. A call with no reply left gets HTTP 500, so an unexpected
 * extra request shows up both in `requests` and in the UI.
 */
export async function mockTranslationSuggestions(page: Page) {
  const requests: Record<string, unknown>[] = [];
  const replies: SuggestionReply[] = [];
  const handler = async (route: Route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    const reply = replies.shift() ?? { status: 500 };
    if ("content" in reply) {
      await route.fulfill({
        json: {
          content: reply.content,
          appliedTerms: reply.appliedTerms ?? [],
          glossaryViolations: reply.glossaryViolations ?? [],
          errors: null,
          isSuccess: true,
        },
      });
    } else {
      await route.fulfill({ status: reply.status, json: { errors: "scripted failure" } });
    }
  };
  await page.route(isTranslationSuggestionUrl, handler);
  return {
    requests,
    /** Clears the recorded requests and sets the replies for the next suggestion. */
    script(...next: SuggestionReply[]) {
      requests.length = 0;
      replies.splice(0, replies.length, ...next);
    },
    stop: () => page.unroute(isTranslationSuggestionUrl, handler),
  };
}

/**
 * Records every `/Glossary/Match` request body (the request still reaches the server). With
 * `keep`, each real response is trimmed to this run's fixture terms, so other terms of the shared
 * project don't change what is highlighted.
 */
export async function trackGlossaryMatches(
  page: Page,
  keep?: (match: ApiGlossaryMatch) => boolean,
) {
  const requests: { text: string; language: string; keyId?: string; moduleId?: string }[] = [];
  const handler = async (route: Route) => {
    requests.push(route.request().postDataJSON() as (typeof requests)[number]);
    if (!keep) return route.fallback();
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const body = (await response.json()) as { matches?: ApiGlossaryMatch[] };
    await route.fulfill({
      status: response.status(),
      json: { ...body, matches: (body.matches ?? []).filter(keep) },
    });
  };
  await page.route(isGlossaryMatchUrl, handler);
  return {
    requests,
    /** The requests made for exactly this source text. */
    forText: (text: string) => requests.filter((request) => request.text === text),
    stop: () => page.unroute(isGlossaryMatchUrl, handler),
  };
}

/**
 * Records every request of the removed Track A full-glossary load (SPEC7 H13: there must be none).
 * Registered as a listener, so it never changes the response.
 */
export function guardFullGlossaryLoads(page: Page) {
  const urls: string[] = [];
  const onRequest = (request: Request) => {
    if (isFullGlossaryPageUrl(new URL(request.url()))) urls.push(request.url());
  };
  page.on("request", onRequest);
  return { urls, stop: () => page.off("request", onRequest) };
}

export class TranslationsPage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly translationKeysTab: Locator;
  private readonly historyTab: Locator;
  private readonly newKeyButton: Locator;
  private readonly publishChangesButton: Locator;
  private readonly autoTranslateButton: Locator;
  private readonly viewDropdownButton: Locator;
  private readonly tableViewport: Locator;
  private readonly importExportMenuButton: Locator;
  private readonly importKeysMenuItem: Locator;
  private readonly exportKeysMenuItem: Locator;
  private readonly exportHistoryMenuItem: Locator;
  private readonly importKeysDialog: Locator;
  private readonly exportKeysDialog: Locator;
  private readonly exportHistoryHeading: Locator;
  private readonly searchInput: Locator;
  private readonly bulkEditButton: Locator;
  private readonly bulkDeleteButton: Locator;
  private readonly deleteDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "Configure keys" });
    this.translationKeysTab = page.getByRole("tab", { name: "Translation Keys" });
    this.historyTab = page.getByRole("tab", { name: "History" });
    this.newKeyButton = page.getByRole("button", { name: "New Key" });
    this.publishChangesButton = page.getByRole("button", { name: "Publish Changes" });
    this.autoTranslateButton = page.getByRole("button", { name: "Auto-translate all" });
    this.viewDropdownButton = page.getByRole("button", { name: "View" });
    this.tableViewport = page.getByTestId("language-table-viewport");
    this.importExportMenuButton = page.locator("button:has(svg.lucide-ellipsis-vertical)");
    this.importKeysMenuItem = page.getByRole("menuitem", { name: "Import keys" });
    this.exportKeysMenuItem = page.getByRole("menuitem", { name: "Export keys" });
    this.exportHistoryMenuItem = page.getByRole("menuitem", { name: "Export History" });
    this.importKeysDialog = page.getByRole("heading", { name: "Import Keys" });
    this.exportKeysDialog = page.getByRole("dialog", { name: "Export keys" });
    this.exportHistoryHeading = page.getByRole("heading", { name: "Export History" });
    this.searchInput = page.getByPlaceholder("Search...").first();
    this.bulkEditButton = page.getByRole("button", { name: "Bulk edit" });
    this.bulkDeleteButton = page.getByRole("button", { name: "Delete" });
    this.deleteDialog = page.getByRole("dialog", { name: "Delete language keys?" });
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.translationKeysTab).toBeVisible();
    await expect(this.historyTab).toBeVisible();
  }

  async expectTranslationKeysTabActive() {
    await expect(this.translationKeysTab).toHaveAttribute("data-state", "active");
  }

  async expectHistoryTabActive() {
    await expect(this.historyTab).toHaveAttribute("data-state", "active");
  }

  async switchToHistoryTab() {
    await this.historyTab.click();
    await this.expectHistoryTabActive();
  }

  async expectHistoryHeadingVisible() {
    await expect(this.page.getByRole("heading", { name: "History" })).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectHistoryEntryVisible() {
    // Timeline entries are "Inserted/Updated by import by" or "Published by"
    // (localization-timeline.tsx); the list only keeps recent entries, so any
    // of the verbs is a valid history record.
    await expect(
      this.page
        .getByRole("button", { name: /(Inserted|Updated) by import by|Published by/ })
        .first(),
    ).toBeVisible();
  }

  async openTranslationKeysTab() {
    await this.translationKeysTab.click();
    await this.expectTranslationKeysTabActive();
  }

  async expectTranslationsHeadingVisible() {
    await expect(this.page.getByRole("heading", { name: "Translations" })).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectTableToolbarButtonsVisible() {
    await expect(this.page.getByRole("button", { name: "Modules" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Missing Translations" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Create Date" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Last Update Date" })).toBeVisible();
  }

  async openImportExportMenu() {
    await this.importExportMenuButton.click();
  }

  async expectImportExportOptionsVisible() {
    await expect(this.page.getByText("Import Keys")).toBeVisible();
    await expect(this.page.getByText("Export Keys")).toBeVisible();
    await expect(this.page.getByText("Export History")).toBeVisible();
  }

  async openImportKeysModal() {
    await this.importKeysMenuItem.click();
    await expect(this.importKeysDialog).toBeVisible();
  }

  async closeImportKeysModal() {
    const closeButton = this.page.getByRole("button", { name: "Close" });
    await closeButton.click();
    await expect(this.importKeysDialog).toBeHidden();
  }

  async selectFileType(type: "JSON" | "CSV") {
    const combobox = this.page.getByRole("combobox");
    await combobox.click();
    await this.page.getByRole("option", { name: type }).click();
  }

  async uploadJsonFile(filePath: string) {
    const chooseFileButton = this.page.getByRole("button", { name: "Choose File" });
    await chooseFileButton.setInputFiles(filePath);
  }

  async removeUploadedFile() {
    const removeItemButton = this.page.getByRole("button", { name: "remove item" });
    await removeItemButton.click();
  }

  async resetFileInput(filePath: string) {
    const chooseFileButton = this.page.getByRole("button", { name: "Choose File" });
    await chooseFileButton.evaluate((el) => {
      (el as HTMLInputElement).value = "";
    });
    await chooseFileButton.setInputFiles(filePath);
  }

  async expectUploadedFileNameVisible(fileName: string) {
    await expect(this.page.getByText(fileName, { exact: true })).toBeVisible({ timeout: 15_000 });
  }

  async clickUploadButton() {
    const uploadButton = this.page.getByRole("button", { name: "Upload" });
    await expect(uploadButton).toBeEnabled({ timeout: 15_000 });
    await uploadButton.click();
  }

  async expectUploadSuccessVisible() {
    await expect(
      this.page.getByText("Upload complete. Your translation keys are being processed.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 60_000 });
  }

  async openExportKeysDialog() {
    await this.exportKeysMenuItem.click();
    await expect(this.exportKeysDialog).toBeVisible({ timeout: 15_000 });
  }

  async expectExportKeysDateRangeVisible() {
    await expect(this.page.getByText("Date Range", { exact: true })).toBeVisible();
  }

  async expectSelectFileTypeButtonDisabled() {
    await expect(this.page.getByRole("button", { name: "Select file type" })).toBeDisabled();
  }

  async expectSelectFileTypeButtonEnabled() {
    await expect(this.page.getByRole("button", { name: "Select file type" })).toBeEnabled({
      timeout: 10_000,
    });
  }

  async toggleSelectAllCheckbox() {
    const selectAllCheckbox = this.page.locator("#select-all");
    await selectAllCheckbox.click();
  }

  async getExportDialogModuleNames(): Promise<string[]> {
    const moduleLabels = this.exportKeysDialog.locator(".grid label");
    await expect(moduleLabels.first()).toBeVisible({ timeout: 15_000 });
    const names = await moduleLabels.allTextContents();
    return names.map((name) => name.trim()).filter(Boolean);
  }

  async toggleModuleCheckbox(moduleName: string) {
    await this.page.getByRole("checkbox", { name: moduleName }).click();
  }

  async expectSelectAllChecked() {
    await expect(this.page.locator("#select-all")).toBeChecked();
  }

  async expectSelectAllUnchecked() {
    await expect(this.page.locator("#select-all")).not.toBeChecked();
  }

  async expectModuleCheckboxChecked(moduleName: string) {
    await expect(this.page.getByRole("checkbox", { name: moduleName })).toBeChecked();
  }

  async openFileTypeSelection() {
    await this.page.getByRole("button", { name: "Select file type" }).click();
    await expect(this.exportKeysDialog).toBeVisible();
  }

  async expectJsonRadioVisible() {
    await expect(this.page.getByRole("radio", { name: "JSON" })).toBeVisible();
  }

  async selectExportFileType(type: "JSON" | "XLSX" | "CSV") {
    await this.page.getByRole("radio", { name: type }).check();
  }

  async expectExportFileTypeSelected(type: "JSON" | "XLSX" | "CSV") {
    await expect(this.page.getByRole("radio", { name: type })).toBeChecked();
  }

  async clickBackButton() {
    const backButton = this.page.getByRole("button", { name: "Back" });
    await expect(backButton).toBeVisible();
    await backButton.click();
  }

  async clickExportButton() {
    await this.page.locator("#download").setChecked(true);
    await expect(this.page.getByRole("button", { name: "Export" })).toBeEnabled();
    await this.page.getByRole("button", { name: "Export" }).click();
  }

  async expectExportPreparingMessageVisible() {
    await expect(
      this.page.getByText(
        "Your export is being prepared. The download will start when the file is ready.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
  }

  async openExportHistory() {
    await this.openImportExportMenu();
    await expect(this.exportHistoryMenuItem).toBeVisible({ timeout: 15_000 });
    await this.exportHistoryMenuItem.click();
    await expect(this.exportHistoryHeading).toBeVisible({ timeout: 15_000 });
  }

  async expectExportHistoryColumnsVisible() {
    await expect(this.page.getByRole("columnheader", { name: "File Name" })).toBeVisible();
    await expect(this.page.getByRole("columnheader", { name: "Date" })).toBeVisible();
    await expect(this.page.getByRole("columnheader", { name: "Download" })).toBeVisible();
  }

  async expectExportHistoryDateFilterVisible() {
    await expect(this.page.getByRole("button", { name: "Date" })).toBeVisible();
  }

  async goBackToTranslationsFromExportHistory() {
    await this.page
      .getByRole("button")
      .filter({ has: this.page.locator(".lucide-arrow-left") })
      .click();
    await this.expectTranslationsHeadingVisible();
  }

  async expectPublishChangesButtonVisible() {
    await expect(this.publishChangesButton).toBeVisible({ timeout: 15_000 });
  }

  async openNewKeyDialog() {
    await this.newKeyButton.click();
    await expect(this.page.getByRole("heading", { name: "Create new key" })).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectNewKeyDialogLoaded() {
    await expect(this.page.getByRole("heading", { name: "About the key" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Translations" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Routes" })).toBeVisible();
    await expect(this.page.getByPlaceholder("Enter key name")).toBeVisible();
    await expect(this.page.getByText("Select Module...", { exact: true })).toBeVisible();
    await expect(this.page.getByPlaceholder("Enter default value")).toBeVisible();
    await expect(this.page.getByPlaceholder("Enter key context (optional)")).toBeVisible();
  }

  async expectSaveButtonDisabled() {
    await expect(this.page.getByRole("button", { name: "Save" })).toBeDisabled();
  }

  async fillKeyName(name: string) {
    const keyNameInput = this.page.getByPlaceholder("Enter key name");
    await keyNameInput.fill(name);
  }

  async expectKeyNameValidationVisible() {
    await expect(this.page.getByText("Key name must be at least 3 characters")).toBeVisible({
      timeout: 10_000,
    });
  }

  async expectKeyNameValidationHidden() {
    await expect(this.page.getByText("Key name must be at least 3 characters")).toHaveCount(0);
  }

  async selectFirstModule() {
    const moduleTrigger = this.page.getByText("Select Module...", { exact: true });
    await moduleTrigger.click();
    const firstModule = this.page.getByRole("option").first();
    await expect(firstModule).toBeVisible({ timeout: 10_000 });
    await firstModule.click();
    await expect(this.page.getByText("Select Module...", { exact: true })).toHaveCount(0);
  }

  async fillDefaultValue(value: string) {
    await this.page.getByPlaceholder("Enter default value").fill(value);
  }

  async expectSaveButtonEnabled() {
    await expect(this.page.getByRole("button", { name: "Save" })).toBeEnabled({ timeout: 10_000 });
  }

  async clickSaveButton() {
    await this.page.getByRole("button", { name: "Save" }).click();
  }

  async expectKeyAddedSuccess() {
    await expect
      .poll(
        () =>
          this.page
            .getByText("Language key added", { exact: true })
            .isVisible()
            .catch(() => false),
        { timeout: 20_000 },
      )
      .toBeTruthy();
  }

  async expectRedirectedToTranslations() {
    await expect(this.page).toHaveURL(/\/services\/language$/, { timeout: 20_000 });
    await this.expectTranslationsHeadingVisible();
  }

  async openAutoTranslateAll() {
    await this.autoTranslateButton.click();
    await expect(this.page.getByRole("button", { name: "Yes" })).toBeVisible();
  }

  async confirmAutoTranslate() {
    await this.page.getByRole("button", { name: "Yes" }).click();
  }

  async expectAutoTranslateProgressVisible() {
    await expect(this.page.getByText("Keys translation in progress.", { exact: true })).toBeVisible(
      { timeout: 15_000 },
    );
  }

  async openViewDropdown() {
    const viewButton = this.page.getByRole("button", { name: "View" });
    await expect(viewButton).toBeVisible();
    await viewButton.click();
  }

  async searchKeys(query: string) {
    await this.searchInput.fill(query);
  }

  async expectNoMatchingKeys() {
    await expect(this.page.getByText("No matching translation keys", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  }

  async clearSearch() {
    await this.searchInput.fill("");
  }

  async expectFirstDataRowVisible() {
    const firstDataRow = this.page
      .getByRole("row")
      .filter({ has: this.page.locator("td") })
      .first();
    await expect(firstDataRow).toBeVisible();
  }

  async selectFirstKeyCheckbox() {
    const firstDataRow = this.page
      .getByRole("row")
      .filter({ has: this.page.locator("td") })
      .first();
    await firstDataRow.getByRole("checkbox").first().check();
  }

  async expectBulkActionsVisible() {
    await expect(this.bulkEditButton).toBeVisible({ timeout: 10_000 });
    await expect(this.bulkDeleteButton).toBeVisible();
  }

  async expectBulkActionsHidden() {
    await expect(this.bulkEditButton).toHaveCount(0);
    await expect(this.bulkDeleteButton).toHaveCount(0);
  }

  async openBulkDeleteDialog() {
    await this.bulkDeleteButton.click();
    await expect(this.deleteDialog).toBeVisible();
  }

  async cancelBulkDeleteDialog() {
    await this.deleteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.deleteDialog).toHaveCount(0);
  }

  async goToNextPage() {
    const next = this.page.getByRole("button", { name: "Go to next page" });
    // The button is always rendered and is disabled while everything fits on one page.
    if (await next.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await next.click();
      await expect(this.page.getByRole("button", { name: "Go to previous page" })).toBeEnabled();
    }
  }

  private translationKeysTable() {
    return this.tableViewport.locator("table");
  }

  async selectAllLanguagesInView() {
    await this.openViewDropdown();
    const languagesMaster = this.page.getByLabel("Languages");
    if (!(await languagesMaster.isChecked())) {
      await languagesMaster.click();
    }
    await this.page.keyboard.press("Escape");
  }

  async enableOptionalViewColumn(name: "Completeness" | "Created Date" | "Last Updated Date") {
    await this.openViewDropdown();
    const item = this.page.getByRole("menuitemcheckbox", { name });
    if ((await item.getAttribute("aria-checked")) !== "true") {
      await item.click();
    }
    await this.page.keyboard.press("Escape");
  }

  async toggleOptionalViewColumn(name: "Completeness" | "Created Date" | "Last Updated Date") {
    await this.openViewDropdown();
    await this.page.getByRole("menuitemcheckbox", { name }).click();
    await this.page.keyboard.press("Escape");
  }

  async getViewLanguageNames() {
    await this.openViewDropdown();
    const optionalColumns = new Set(["Completeness", "Created Date", "Last Updated Date"]);
    const items = this.page.getByRole("menuitemcheckbox");
    const names: string[] = [];

    for (let index = 0; index < (await items.count()); index += 1) {
      const name = (await items.nth(index).innerText()).trim();
      if (name && !optionalColumns.has(name)) names.push(name);
    }

    await this.page.keyboard.press("Escape");
    return names;
  }

  async toggleViewLanguage(languageName: string) {
    await this.openViewDropdown();
    await this.page.getByRole("menuitemcheckbox", { name: languageName }).click();
    await this.page.keyboard.press("Escape");
  }

  async expectActionsColumnLeftOfKeyColumn() {
    // Skip the trailing aria-hidden filler header the table appends after the data columns.
    const headers = this.translationKeysTable()
      .locator("thead tr")
      .first()
      .locator("th:not([aria-hidden='true'])");
    const count = await headers.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // The actions column renders an unlabeled sticky header right after the
    // select checkbox and immediately before the Key column
    // (use-language-table-columns.tsx defines only a cell renderer, no header).
    const actionsHeaderText = (await headers.nth(1).innerText()).replace(/\s+/g, " ").trim();
    expect(actionsHeaderText).toBe("");

    const keyHeaderText = (await headers.nth(2).innerText()).replace(/\s+/g, " ").trim();
    expect(keyHeaderText).toBe("Key");

    // The last column is a labelled data column, not the unlabeled actions one.
    const lastHeaderText = (await headers.nth(count - 1).innerText()).replace(/\s+/g, " ").trim();
    expect(lastHeaderText).not.toBe("");
  }

  async expectTableRequiresHorizontalScroll() {
    const metrics = await this.tableViewport.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  }

  async scrollTranslationTableToEnd() {
    await this.tableViewport.evaluate((element) => {
      element.scrollLeft = element.scrollWidth - element.clientWidth;
    });
  }

  async expectStickySelectAndActionsVisible() {
    await expect(this.page.getByLabel("Select all")).toBeInViewport();
    await expect(this.page.getByRole("button", { name: /^Expand / }).first()).toBeInViewport();
  }

  async expandFirstTranslationKey() {
    await this.page
      .getByRole("button", { name: /^Expand / })
      .first()
      .click();
  }

  async expectInlineKeyEditorVisible() {
    await expect(this.page.getByRole("textbox", { name: / translation$/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  }

  async editFirstInlineTranslationAndSave(value: string) {
    const translationInput = this.page.getByRole("textbox", { name: / translation$/i }).first();
    await translationInput.fill(value);
    await this.page.getByRole("button", { name: "Save changes" }).click();
  }

  async expectInlineTranslationSaved() {
    await expect(
      this.page.getByText("Language key updated successfully", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async openExpandedRowOverflowActions() {
    await this.page
      .getByRole("button", { name: /^Actions for / })
      .first()
      .click();
  }

  async expectExpandedRowOverflowMenuVisible() {
    await expect(this.page.getByRole("menuitem", { name: "Translate" })).toBeVisible();
    await expect(this.page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  }

  async closeExpandedRowOverflowMenu() {
    await this.page.keyboard.press("Escape");
  }

  async expectExpandedInlineRowSpansFullTableWidth() {
    const columnCount = await this.translationKeysTable()
      .locator("thead tr")
      .first()
      .locator("th")
      .count();
    const expandedCell = this.page
      .locator("tbody tr")
      .filter({ has: this.page.locator("td[colspan]") })
      .locator("td")
      .first();
    await expect(expandedCell).toHaveAttribute("colspan", String(columnCount));
  }

  // --- Publish Changes ---

  async openPublishChangesDialog() {
    await this.publishChangesButton.click();
    await expect(this.page.getByRole("dialog", { name: "Publish changes?" })).toBeVisible();
  }

  async confirmPublishChanges() {
    const dialog = this.page.getByRole("dialog", { name: "Publish changes?" });
    await dialog.getByRole("button", { name: "Publish" }).click();
  }

  async expectPublishChangesConfirmed() {
    await expect(
      this.page.getByText("File generation is in progress.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
  }

  // --- Toolbar filters ---

  async openModulesFilter() {
    await this.page.getByRole("button", { name: /^Modules/ }).click();
    await expect(this.page.getByPlaceholder("Modules")).toBeVisible();
  }

  async selectModuleFilterOption(moduleName: string) {
    await this.page.getByRole("option", { name: moduleName }).click();
  }

  async selectFirstModuleFilterOption(): Promise<string> {
    const firstOption = this.page.getByRole("option").first();
    await expect(firstOption).toBeVisible();
    const moduleName = ((await firstOption.innerText()) || "").trim();
    await firstOption.click();
    return moduleName;
  }

  async expectModuleFilterBadgeVisible(moduleName: string) {
    await expect(
      this.page.getByRole("button", { name: /^Modules/ }).getByText(moduleName, { exact: true }),
    ).toBeVisible();
  }

  async closeFilterPopover() {
    await this.page.keyboard.press("Escape");
  }

  async openMissingTranslationsFilter() {
    await this.page.getByRole("button", { name: /^Missing Translations/ }).click();
    await expect(this.page.getByPlaceholder("Missing Translations")).toBeVisible();
  }

  async resetFilters() {
    await this.page.getByRole("button", { name: /^Reset/ }).click();
  }

  async expectFiltersReset() {
    await expect(this.page.getByRole("button", { name: /^Modules/ })).not.toContainText("selected");
  }

  // --- Sorting ---

  async sortByKeyColumn() {
    await this.page.getByRole("button", { name: /^Key/ }).click();
  }

  async expectSortApplied(descending: boolean) {
    await expect(this.page).toHaveURL(
      descending ? /[?&]sort-isDescending=true(?:&|$)/ : /[?&]sort-isDescending=false(?:&|$)/,
    );
  }

  // --- Pagination ---

  async changePageSize(size: number) {
    await this.page.getByText("Rows per page").locator("..").getByRole("combobox").click();
    await this.page.getByRole("option", { name: String(size), exact: true }).click();
  }

  /**
   * Opens the Rows per page select and returns its option labels, leaving it open.
   * Options depend on the key count: 10, then 30/50/100 below the total, then
   * the total itself as "All (N)". A project with 10 keys or fewer offers only 10.
   */
  async openPageSizeOptions(): Promise<string[]> {
    await this.page.getByText("Rows per page").locator("..").getByRole("combobox").click();
    const options = this.page.getByRole("listbox").getByRole("option");
    await expect(options.first()).toBeVisible();
    return (await options.allInnerTexts()).map((label) => label.trim());
  }

  async choosePageSizeOption(label: string) {
    await this.page.getByRole("option", { name: label, exact: true }).click();
  }

  /** Waits until the "N keys" badge reports at least minCount, reloading while an import is still processing. */
  async waitForTotalKeyCountAtLeast(minCount: number) {
    const badge = this.page.getByText(/^[\d,]+ keys$/).first();
    const readCount = async () => Number(((await badge.textContent()) ?? "").replace(/\D/g, ""));
    await expect(async () => {
      await expect(badge).toBeVisible({ timeout: 15_000 });
      if ((await readCount()) < minCount) {
        await this.page.reload();
        await expect(badge).toBeVisible({ timeout: 15_000 });
      }
      expect(await readCount()).toBeGreaterThanOrEqual(minCount);
    }).toPass({ timeout: 90_000, intervals: [2_000, 5_000] });
  }

  async expectRowCountAtLeast(minCount: number) {
    const dataRows = this.tableViewport
      .locator("tbody tr")
      .filter({ has: this.page.locator("td") });
    await expect
      .poll(async () => dataRows.count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(minCount);
  }

  // --- Bulk actions ---

  async expectSelectionBannerVisible(count: number) {
    await expect(
      this.page.getByText(`${count} key${count > 1 ? "s" : ""} selected`, { exact: true }),
    ).toBeVisible();
  }

  async clearSelection() {
    await this.page.getByRole("button", { name: "Clear selection" }).click();
    await expect(this.page.getByText(/keys? selected/, { exact: false })).toHaveCount(0);
  }

  async openBulkEditDialog(count: number) {
    await this.bulkEditButton.click();
    await expect(
      this.page.getByRole("dialog", {
        name: `Bulk edit ${count} ${count === 1 ? "key" : "keys"}`,
      }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async cancelBulkEditDialog(count: number) {
    const dialog = this.page.getByRole("dialog", {
      name: `Bulk edit ${count} ${count === 1 ? "key" : "keys"}`,
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  }

  async openBulkTranslateDialog() {
    await this.page.getByRole("button", { name: "Translate", exact: true }).click();
    await expect(
      this.page.getByRole("dialog", { name: "Auto-translate selected keys?" }),
    ).toBeVisible();
  }

  async cancelBulkTranslateDialog() {
    const dialog = this.page.getByRole("dialog", { name: "Auto-translate selected keys?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  }

  // --- Single-key suggestions (View Details, edit translation, inline editor) ---

  /** The "Edit translation" modal opened from a View Details language row. */
  get editTranslationDialog() {
    return this.page.getByRole("dialog", { name: "Edit translation" });
  }

  /** Opens View Details for a key in the shared project. */
  async openKeyDetails(itemId: string) {
    await new KeyDetailsPage(this.page).navigateTo(itemId, e2eBaseUrl());
    // The cards render once the project languages are loaded.
    await expect(this.page.getByRole("button", { name: "Tag Glossary" })).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Opens the edit translation modal for a non-default language on View Details. */
  async openEditTranslation(languageName: string) {
    const row = this.page
      .locator("div.flex.items-center.justify-between")
      .filter({ has: this.page.getByText(languageName, { exact: true }) });
    await row.getByRole("button", { name: "Edit" }).first().click();
    await expect(this.editTranslationDialog).toBeVisible();
    return this.editTranslationDialog;
  }

  async closeEditTranslation() {
    await this.editTranslationDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.editTranslationDialog).toHaveCount(0);
  }

  get editTranslationTextarea() {
    return this.editTranslationDialog.getByPlaceholder("Enter translation");
  }

  async clickAutoTranslateInDialog() {
    await this.editTranslationDialog.getByRole("button", { name: "Auto-Translate" }).click();
  }

  /**
   * The glossary violation list under a target field: a polite live region (status role,
   * an <output> element) that holds the list.
   */
  violationList(scope: Locator) {
    return scope.getByRole("status").filter({ has: this.page.getByRole("list") });
  }

  violationItem(scope: Locator, message: string) {
    return this.violationList(scope).getByRole("listitem").filter({ hasText: message });
  }

  // --- Glossary terms in the source (SPEC4) ---

  /** A highlighted term (Edit translation) or a "Glossary terms" chip (inline / new key). */
  /** The per-language glossary checklist under a target row (inline editor, new key). */
  glossaryChecklist(scope: Locator | Page, languageName: string) {
    return scope.getByRole("region", { name: `Glossary terms for ${languageName}` });
  }

  glossaryTerm(scope: Locator | Page, surface: string) {
    return scope.getByRole("button", {
      name: new RegExp(`^Glossary term ${escapeRegex(surface)}:`),
    });
  }

  /** The open term popover. */
  get termPopover() {
    // Named by the popover itself, so it also matches the "Add it in the glossary" state.
    return this.page.getByRole("dialog", { name: /^Glossary term / });
  }

  /** Shows the key in the table by searching for it and expands its inline editor. */
  async expandKey(keyName: string) {
    await this.searchKeys(keyName);
    const expand = this.page.getByRole("button", { name: `Expand ${keyName}` });
    await expect(expand).toBeVisible({ timeout: 20_000 });
    await expand.click();
  }

  inlineTranslation(languageName: string) {
    return this.page.getByRole("textbox", { name: `${languageName} translation` });
  }

  async clickInlineAutoTranslate(languageName: string) {
    await this.page.getByRole("button", { name: `Auto-translate ${languageName}` }).click();
  }

  /** Clicks a control and returns the body of the Key/Save request it triggers. */
  async captureKeySave(action: () => Promise<void>): Promise<Record<string, unknown>> {
    const requestPromise = this.page.waitForRequest(
      (request) => request.method() === "POST" && /\/Key\/Save(\?|$)/.test(request.url()),
    );
    await action();
    return (await requestPromise).postDataJSON() as Record<string, unknown>;
  }

  // --- Glossary issues (SPEC7) ---

  /** The Translations table's "Glossary issues" filter checkbox. */
  get glossaryIssuesCheckbox() {
    return this.page.getByRole("checkbox", { name: "Glossary issues" });
  }

  /** The "N glossary issue(s)" badge on a key's row. */
  glossaryIssueBadge(keyName: string) {
    return this.page
      .getByRole("row")
      .filter({ hasText: keyName })
      .getByTestId("glossary-issue-badge");
  }

  /** Focuses a row's issue badge and returns its open tooltip. */
  async openGlossaryIssueTooltip(keyName: string) {
    await this.glossaryIssueBadge(keyName).focus();
    const tooltip = this.page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    return tooltip;
  }

  // --- New key routes ---

  async addRoute() {
    await this.page.getByRole("button", { name: "Add Route" }).click();
    await expect(this.page.getByLabel(/^Route 1/)).toBeVisible();
  }

  async fillFirstRoute(value: string) {
    await this.page.getByLabel(/^Route 1/).fill(value);
  }

  async removeFirstRoute() {
    await this.page.getByRole("button", { name: "Remove Route" }).first().click();
    await expect(this.page.getByLabel(/^Route 1/)).toHaveCount(0);
  }
}
