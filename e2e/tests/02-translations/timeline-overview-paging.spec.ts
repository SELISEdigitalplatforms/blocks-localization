import type { APIResponse, Page } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { BulkKeyApi } from "../../support/bulk-key-api";
import { TranslationsPage } from "../../support/pages/translations.page";

// blocks-localization#347 (Phase 1 of 4): the timeline overview groups and pages large timelines on the server.
// §10 steps 2–4 at dev scale on the shared "test" project's own timeline: the API contract for paging, order,
// filters and edge pages (H1, H4–H6, H9, C4–C6, C12) and the History tab paging through 3 pages (H12).
// Steps that need the 500,000-entry tenant, the old build, pod metrics, index permissions, a second tenant
// or a stopped MongoDB (steps 1, 5–8) are staging-only.

// The portal's default excludes (localization-timeline.tsx DEFAULT_TIMELINE_EXCLUDES).
const DEFAULT_EXCLUDES = ["KeyController.Create", "KeyController.Save", "KeyController.Delete", "TranslateKey", "Rollback"];
const ENTRY_FIELDS = ["affectedKeysCount", "createDate", "currentData", "logFrom", "operationId", "previousData", "userId", "userName"];

interface Operation {
  operationId: string;
  logFrom: string | null;
  userId: string | null;
  userName: string | null;
  createDate: string;
  affectedKeysCount: number;
}
interface Overview {
  totalCount: number;
  operations: Operation[];
}

const isTimelineUrl = (url: string) => /\/Key\/GetLocalizationTimeline\?/.test(url);
// The entry button name begins with the time the timeline renders (localization-timeline.tsx formatDate).
const ENTRY_TIME = /^\d{2}:\d{2}\s?[AP]M/;

async function overview(api: BulkKeyApi, params: Record<string, string | number | string[]>): Promise<Overview> {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) query.append(name, String(item));
  }
  const response: APIResponse = await api.page.request.get(`${api.base}/Key/GetLocalizationTimeline?${query}`, {
    headers: api.headers,
  });
  expect(response.status(), `GetLocalizationTimeline ${query}`).toBe(200);
  return (await response.json()) as Overview;
}

const withDefaults = (page: number, size: number, extra: Record<string, string | number | string[]> = {}) => ({
  PageSize: size,
  PageNumber: page,
  ExcludeLogFromValues: DEFAULT_EXCLUDES,
  ...extra,
});

/** Newest first; equal dates by operation ID, descending too (H4). */
function expectDescending(operations: Operation[]) {
  for (let i = 1; i < operations.length; i += 1) {
    const [a, b] = [operations[i - 1], operations[i]];
    const [ta, tb] = [Date.parse(a.createDate), Date.parse(b.createDate)];
    expect(ta >= tb, `operation ${i} is not newer than operation ${i - 1}`).toBe(true);
    if (ta === tb) expect(a.operationId > b.operationId, `tie at ${i} ordered by operationId`).toBe(true);
  }
}

test("Timeline overview pages, orders and filters operations on the server (#347)", async ({ page }) => {
  test.setTimeout(300_000);
  const api = await BulkKeyApi.capture(page);

  const first = await overview(api, withDefaults(1, 30));
  test.info().annotations.push({ type: "#347 data", description: `totalCount with default excludes: ${first.totalCount}` });
  expect(first.totalCount, "the shared project has timeline history").toBeGreaterThan(0);

  await test.step("§10 step 2/3: fields, order and consecutive pages (H1, H4, H5, H6)", async () => {
    for (const operation of first.operations) {
      expect(Object.keys(operation).sort(), "LocalizationTimelineEntry fields only").toEqual(ENTRY_FIELDS);
      expect(operation.operationId).toBeTruthy();
      expect(operation.affectedKeysCount).toBeGreaterThan(0);
      expect(DEFAULT_EXCLUDES).not.toContain(operation.logFrom);
    }
    expectDescending(first.operations);

    const pages: Operation[] = [];
    for (let n = 1; n <= 3; n += 1) {
      const result = await overview(api, withDefaults(n, 10));
      expect(result.totalCount).toBe(first.totalCount);
      pages.push(...result.operations);
    }
    expect(pages.map((o) => o.operationId), "pages 1–3 of 10 equal page 1 of 30").toEqual(
      first.operations.map((o) => o.operationId),
    );
    expect(new Set(pages.map((o) => o.operationId)).size).toBe(pages.length);

    const ascending = await overview(api, withDefaults(1, 10, { IsDescending: "false" }));
    expect(ascending.totalCount).toBe(first.totalCount);
    for (let i = 1; i < ascending.operations.length; i += 1) {
      expect(Date.parse(ascending.operations[i].createDate)).toBeGreaterThanOrEqual(
        Date.parse(ascending.operations[i - 1].createDate),
      );
    }
  });

  await test.step("§10 step 2: filters keep their operators (H9, H5)", async () => {
    const logFrom = first.operations[0].logFrom;
    if (logFrom) {
      const only = await overview(api, { PageSize: 50, PageNumber: 1, LogFromValues: [logFrom] });
      expect(only.totalCount).toBeGreaterThan(0);
      expect(only.operations.every((o) => o.logFrom === logFrom)).toBe(true);
      const exact = await overview(api, { PageSize: 50, PageNumber: 1, LogFrom: logFrom });
      expect(exact.totalCount).toBe(only.totalCount);
    }
    const newest = first.operations[0].createDate;
    const ranged = await overview(api, withDefaults(1, 50, { "CreateDateRange.StartDate": newest }));
    expect(ranged.totalCount).toBeGreaterThan(0);
    expect(ranged.operations.every((o) => Date.parse(o.createDate) >= Date.parse(newest))).toBe(true);
  });

  await test.step("§10 step 2: edge pages and an empty result (C4, C5, C6, C12)", async () => {
    const zeroSize = await overview(api, withDefaults(1, 0));
    expect(zeroSize).toEqual({ totalCount: first.totalCount, operations: [] });

    const zeroPage = await overview(api, withDefaults(0, 10));
    const pageOne = await overview(api, withDefaults(1, 10));
    expect(zeroPage.operations.map((o) => o.operationId)).toEqual(pageOne.operations.map((o) => o.operationId));

    const farPage = await overview(api, withDefaults(2_147_483_647, 10));
    expect(farPage).toEqual({ totalCount: first.totalCount, operations: [] });

    const none = await overview(api, withDefaults(1, 10, {
      "CreateDateRange.StartDate": "2000-01-01T00:00:00Z",
      "CreateDateRange.EndDate": "2000-01-02T00:00:00Z",
    }));
    expect(none).toEqual({ totalCount: 0, operations: [] });
  });

  await test.step("§10 step 4: the History tab pages through 3 pages (H12)", async () => {
    await pageThroughHistory(page, Math.min(3, Math.ceil(first.totalCount / 10)));
  });
});

async function pageThroughHistory(page: Page, pages: number) {
  const translations = new TranslationsPage(page);
  const firstPage = page.waitForResponse((r) => isTimelineUrl(r.url()) && /PageNumber=1(&|$)/.test(r.url()));
  await translations.switchToHistoryTab();
  await translations.expectHistoryHeadingVisible();
  let response = await firstPage;

  for (let n = 1; n <= pages; n += 1) {
    expect(response.status(), `History page ${n}`).toBe(200);
    expect(new URL(response.url()).searchParams.getAll("ExcludeLogFromValues").sort()).toEqual([...DEFAULT_EXCLUDES].sort());
    const body = (await response.json()) as Overview;
    expect(body.operations.length, `History page ${n} has operations`).toBeGreaterThan(0);
    await expect(page.getByText("No history found")).toHaveCount(0);

    // Every operation of the page is rendered as one entry button, which starts with its time (hh:mm AM/PM),
    // and the newest entry shows the first operation's time.
    await expect(page.getByRole("button", { name: ENTRY_TIME })).toHaveCount(body.operations.length);
    const firstTime = new Date(body.operations[0].createDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await expect(page.getByRole("button", { name: ENTRY_TIME }).first()).toContainText(firstTime);

    if (n < pages) {
      const next = page.waitForResponse(
        (r) => isTimelineUrl(r.url()) && new URL(r.url()).searchParams.get("PageNumber") === String(n + 1),
      );
      await page.getByRole("button", { name: "Go to next page" }).click();
      response = await next;
    }
  }
}
