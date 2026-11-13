import { test, expect } from "../../support/test-base";
import { UilmApi, etagValue, sha256Hex, withPublishedModule } from "../../support/uilm-api";

// blocks-localization#348 (Phase 2 of 4): publish UILM files to Storage and serve them through a pointer.
// §10 steps at dev scale, on a module this test creates and publishes in the shared "test" project.
// Staging-only steps (232-file baseline, blocked Storage egress, tampered blobs, worker kills, concurrent
// publishes, fast-forwarded DeleteAfter, P1–P6, a second identity without the maintenance permission) stay out.

test("UILM files are published to Storage and served with ETags (#348)", async ({ page }) => {
  test.setTimeout(600_000);
  const api = await UilmApi.open(page);
  try {
    await withPublishedModule(api, "e2e-pointer", async ({ moduleId, moduleName, keyName, language, value }) => {
      let etag = "";

      await test.step("§10 step 3: the published file is served from its pointer (H1, H2, H11)", async () => {
        // Two more keys saved out of order: the file lists keys by name (ordinal), so its bytes are stable.
        await api.saveKey(moduleId, `${keyName}_c`, language, "Text c");
        await api.saveKey(moduleId, `${keyName}_a`, language, "Text a");
        await api.publish(moduleId);
        await api.waitForPublishedValue(moduleName, language, `${keyName}_c`, "Text c");

        const file = await api.getFile(moduleName, language);
        expect(file.status()).toBe(200);
        expect(file.headers()["content-type"]).toContain("application/json");
        expect(file.headers()["cache-control"]).toBe("no-cache");
        etag = file.headers()["etag"];
        expect(etag, "strong ETag of the pointer's hash").toMatch(/^"[0-9a-f]{64}"$/);
        const bytes = await file.body();
        expect(bytes[0], "no BOM").not.toBe(0xef);
        expect(sha256Hex(bytes), "ETag is the SHA-256 of the served bytes").toBe(etagValue(etag));
        const body = JSON.parse(bytes.toString("utf8")) as Record<string, string>;
        expect(body[keyName]).toBe(value);
        const names = Object.keys(body);
        expect(names, "keys ordered by name").toEqual([...names].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))));

        const entry = await api.waitForManifestEntry(moduleName, language, etagValue(etag));
        expect(entry.url, "the row points to a Storage file").toBeTruthy();
      });

      await test.step("§10 step 4: If-None-Match strong, weak and * return 304 (H3)", async () => {
        for (const ifNoneMatch of [etag, `W/${etag}`, "*"]) {
          const response = await api.getFile(moduleName, language, { ifNoneMatch });
          expect(response.status(), `If-None-Match ${ifNoneMatch === etag ? "strong" : ifNoneMatch}`).toBe(304);
          expect((await response.body()).length).toBe(0);
          expect(response.headers()["etag"]).toBe(etag);
        }
        expect((await api.getFile(moduleName, language, { ifNoneMatch: '"0000"' })).status()).toBe(200);
      });

      await test.step("§10 step 5: an unchanged publish keeps the pointer; a changed text replaces it (H4, H5)", async () => {
        const before = (await api.manifest({ moduleName, language })).files[0];
        await api.publish(moduleId);
        // The unchanged publish is a skip: wait for its history to settle, then the pointer must be the same.
        await expect
          .poll(async () => (await api.manifest({ moduleName, language })).files[0]?.url, { timeout: 30_000 })
          .toBe(before.url);
        expect((await api.manifest({ moduleName, language })).files[0]).toEqual(before);

        const changed = `Changed text ${Date.now()}`;
        await api.saveKey(moduleId, keyName, language, changed);
        await api.publish(moduleId);
        await api.waitForPublishedValue(moduleName, language, keyName, changed);
        const next = await api.getFile(moduleName, language);
        expect(next.headers()["etag"]).not.toBe(etag);
        expect((await api.getFile(moduleName, language, { ifNoneMatch: etag })).status(), "old ETag no longer matches").toBe(200);
        etag = next.headers()["etag"];
      });

      await test.step("§10 step 6: forceUpload uploads the same bytes again under a new file (H6)", async () => {
        const before = (await api.manifest({ moduleName, language })).files[0];
        await api.publish(moduleId, true);
        await expect
          .poll(async () => (await api.manifest({ moduleName, language })).files[0]?.url, { timeout: 180_000, intervals: [2_000, 5_000] })
          .not.toBe(before.url);
        const after = (await api.manifest({ moduleName, language })).files[0];
        expect(after.hash, "same bytes, same hash").toBe(before.hash);
        expect(after.version).toBeGreaterThan(before.version ?? 0);
        expect((await api.getFile(moduleName, language)).headers()["etag"]).toBe(etag);
      });

      await test.step("§10 C2: a module and language without a row return an empty 200 without ETag", async () => {
        const missing = await api.getFile(`${moduleName}-none`, language);
        expect(missing.status()).toBe(200);
        expect((await missing.body()).length).toBe(0);
        expect(missing.headers()["etag"]).toBeUndefined();
      });

      await test.step("§10 step 17: another key never gets this project's file (C11)", async () => {
        const other = await api.getFile(moduleName, language, { projectKey: "0".repeat(32) });
        const text = other.status() === 200 ? await other.text() : "";
        expect(text, "no data of this project").not.toContain(keyName);
      });
    });
  } finally {
    await api.dispose();
  }
});
