import { test, expect } from "../../support/test-base";
import { UilmApi, withPublishedModule } from "../../support/uilm-api";

// blocks-localization#349 (Phase 3 of 4): backfill UILM files to Storage and retire `Content`.
// Server-only change. §10 at dev scale: trigger the tenant's maintenance run and the restore task through
// RunUilmMaintenance, and check that every file keeps its bytes and ETag (H2, H7). Legacy-row fixtures,
// blocked Storage, KeepContent=false, blocks-os DataCleanupAsync, worker kills and k6 load are staging-only.

// The run is queued for the worker; the API cannot report when it finished. Files are watched this long
// after each queueing, and each read must be identical to the one before.
const WATCH_MS = 60_000;

test("UILM maintenance keeps every published file byte-identical (#349)", async ({ page }) => {
  test.setTimeout(600_000);
  const api = await UilmApi.open(page);
  try {
    await withPublishedModule(api, "e2e-maintenance", async ({ moduleName, language }) => {
      const snapshot = async () => {
        const response = await api.getFile(moduleName, language);
        return { status: response.status(), etag: response.headers()["etag"], body: (await response.body()).toString("base64") };
      };
      const before = await snapshot();
      expect(before.status).toBe(200);
      expect(before.etag).toBeTruthy();
      const manifestBefore = (await api.manifest({ moduleName })).files;

      const expectUnchanged = async (label: string) => {
        const deadline = Date.now() + WATCH_MS;
        while (Date.now() < deadline) {
          expect(await snapshot(), `${label}: GetUilmFile bytes and ETag`).toEqual(before);
          await page.waitForTimeout(10_000);
        }
        expect((await api.manifest({ moduleName })).files, `${label}: manifest entries`).toEqual(manifestBefore);
      };

      await test.step("§10 step 12: no body runs uilm-maintenance for this tenant (H11, H2, H7)", async () => {
        const response = await api.runMaintenance();
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({ isSuccess: true });
        await expectUnchanged("after uilm-maintenance");
      });

      await test.step("§10 step 10: uilm-restore-content keeps the files (H8)", async () => {
        const response = await api.runMaintenance({ task: "uilm-restore-content" });
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({ isSuccess: true });
        await expectUnchanged("after uilm-restore-content");
      });

      await test.step("§10 step 12: another task name changes nothing (C12)", async () => {
        const response = await api.runMaintenance({ task: "e2e-unknown-task" });
        expect(response.status()).toBeLessThan(500);
        await expectUnchanged("after an unknown task");
      });
    });
  } finally {
    await api.dispose();
  }
});
