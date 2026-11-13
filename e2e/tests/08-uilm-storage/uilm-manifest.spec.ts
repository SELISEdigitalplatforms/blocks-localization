import { test, expect } from "../../support/test-base";
import { UilmApi, etagValue, sha256Hex, withPublishedModule } from "../../support/uilm-api";

// blocks-localization#350 (Phase 4 of 4): GetUilmManifest for direct downloads from Storage.
// §10 steps at dev scale, on a module this test creates and publishes in the shared "test" project.
// Staging-only steps (2,000-row tenant, blocked Storage/MongoDB, fast-forwarded deletion, P1 timing) stay out.

test("UILM manifest lists the published files with Storage URLs and ETags (#350)", async ({ page }) => {
  test.setTimeout(600_000);
  const api = await UilmApi.open(page);
  try {
    await withPublishedModule(api, "e2e-manifest", async ({ moduleId, moduleName, keyName, language }) => {
      let entry = (await api.manifest({ moduleName, language })).files[0];

      await test.step("§10 step 1: no filter, Language and ModuleName filters (H1, H2, H9)", async () => {
        const all = await api.getManifest();
        expect(all.status()).toBe(200);
        expect(all.headers()["content-type"]).toContain("application/json");
        expect(all.headers()["cache-control"]).toBe("no-cache");
        expect(all.headers()["etag"]).toMatch(/^"[0-9a-f]{64}"$/);
        const manifest = (await all.json()) as { version: number; files: { moduleName: string; language: string; version: number | null }[] };
        const order = manifest.files.map((f) => `${f.moduleName}\t${f.language}`);
        const sorted = [...manifest.files]
          .sort((a, b) =>
            a.moduleName === b.moduleName
              ? Buffer.compare(Buffer.from(a.language), Buffer.from(b.language))
              : Buffer.compare(Buffer.from(a.moduleName), Buffer.from(b.moduleName)),
          )
          .map((f) => `${f.moduleName}\t${f.language}`);
        expect(order, "sorted by module, then language (ordinal)").toEqual(sorted);
        expect(new Set(order).size, "one entry per module and language").toBe(order.length);
        const versions = manifest.files.map((f) => f.version ?? 0);
        expect(manifest.version).toBe(Math.max(0, ...versions));

        const byModule = await api.manifest({ moduleName });
        expect(byModule.files.length).toBeGreaterThan(0);
        expect(byModule.files.every((f) => f.moduleName === moduleName)).toBe(true);
        expect(byModule.files.map((f) => f.language).sort()).toEqual(
          manifest.files.filter((f) => f.moduleName === moduleName).map((f) => f.language).sort(),
        );

        const byLanguage = await api.manifest({ language });
        expect(byLanguage.files.length).toBeGreaterThan(0);
        expect(byLanguage.files.every((f) => f.language === language)).toBe(true);
        expect(byLanguage.files.some((f) => f.moduleName === moduleName)).toBe(true);

        // Filters match exactly and case-sensitively.
        expect((await api.manifest({ moduleName: moduleName.toUpperCase() })).files).toEqual([]);
      });

      await test.step("§10 step 2: the URL's bytes match the hash and the GetUilmFile body (H3, H4)", async () => {
        expect(entry, "manifest entry of the published module").toBeTruthy();
        expect(entry.url, "a published file has a Storage URL").toBeTruthy();
        expect(entry.size).toBeGreaterThan(0);
        expect(entry.version).toBeGreaterThan(0);

        const file = await api.getFile(moduleName, language);
        expect(file.status()).toBe(200);
        const fileBytes = await file.body();
        expect(etagValue(file.headers()["etag"]), "hash equals the GetUilmFile ETag value").toBe(entry.hash);

        // Download as a client would: no project key, no session.
        const download = await api.anonymous.get(entry.url!, { headers: {} });
        expect(download.status()).toBe(200);
        const bytes = await download.body();
        expect(sha256Hex(bytes)).toBe(entry.hash);
        expect(bytes.equals(fileBytes), "Storage bytes equal the GetUilmFile body").toBe(true);
        expect(bytes.length).toBe(entry.size);
      });

      await test.step("§10 step 3: If-None-Match strong, weak and * return 304 (H5, C7)", async () => {
        const etag = (await api.getManifest({ moduleName })).headers()["etag"];
        for (const ifNoneMatch of [etag, `W/${etag}`, "*", `"0000", ${etag}`]) {
          const response = await api.getManifest({ moduleName }, { ifNoneMatch });
          expect(response.status(), `If-None-Match ${ifNoneMatch === etag ? "strong" : ifNoneMatch}`).toBe(304);
          expect((await response.body()).length).toBe(0);
        }
        expect((await api.getManifest({ moduleName }, { ifNoneMatch: '"0000"' })).status()).toBe(200);
      });

      await test.step("§10 step 4: a publish changes the ETag and URL; the old URL still works (H6, H11)", async () => {
        const before = await api.getManifest({ moduleName });
        const beforeEtag = before.headers()["etag"];
        const oldUrl = entry.url!;
        const value = `Second text ${Date.now()}`;
        await api.saveKey(moduleId, keyName, language, value);
        await api.publish(moduleId);
        await api.waitForPublishedValue(moduleName, language, keyName, value);

        const fileEtag = etagValue((await api.getFile(moduleName, language)).headers()["etag"]);
        entry = await api.waitForManifestEntry(moduleName, language, fileEtag);
        expect(entry.url).not.toBe(oldUrl);
        const after = await api.getManifest({ moduleName });
        expect(after.headers()["etag"]).not.toBe(beforeEtag);
        expect((await api.getManifest({ moduleName }, { ifNoneMatch: beforeEtag })).status()).toBe(200);

        const old = await api.anonymous.get(oldUrl, { headers: {} });
        expect(old.status(), "the replaced file stays downloadable for 24 h").toBe(200);
      });

      await test.step("§10 step 5: empty filter, another project's key and a missing key (H8, C2, C3)", async () => {
        const none = await api.getManifest({ moduleName: `${moduleName}-none` });
        expect(none.status()).toBe(200);
        expect(await none.json()).toEqual({ version: 0, files: [] });
        expect(none.headers()["etag"]).toBeTruthy();

        // A key of no project: same answer as GetUilmFile gives for it.
        const unknownKey = "0".repeat(32);
        const manifestUnknown = await api.getManifest({}, { projectKey: unknownKey });
        const fileUnknown = await api.getFile(moduleName, language, { projectKey: unknownKey });
        expect(manifestUnknown.status()).toBe(fileUnknown.status());
        if (manifestUnknown.status() === 200) {
          const listed = ((await manifestUnknown.json()) as { files?: { moduleName: string }[] }).files ?? [];
          expect(listed.some((f) => f.moduleName === moduleName), "no data of this project").toBe(false);
        }

        const manifestMissing = await api.getManifest({}, { projectKey: null });
        const fileMissing = await api.getFile(moduleName, language, { projectKey: null });
        expect(manifestMissing.status()).toBe(fileMissing.status());
      });

      await test.step("§10 steps 7 and 8: Storage headers and a credential-less cross-origin fetch (recorded)", async () => {
        const head = await api.anonymous.head(entry.url!, { headers: {} });
        test.info().annotations.push({
          type: "#350 step 7",
          description: `HEAD ${head.status()} content-type=${head.headers()["content-type"] ?? "-"} cache-control=${head.headers()["cache-control"] ?? "-"}`,
        });

        // Any page on another origin; the result depends on the Storage CORS prerequisite and is recorded only.
        const other = await page.context().newPage();
        try {
          await other.goto("about:blank");
          await other.setContent("<p>cross-origin check</p>");
          const result = await other.evaluate(async (url) => {
            try {
              const response = await fetch(url, { credentials: "omit" });
              return `status ${response.status}`;
            } catch (error) {
              return `blocked (${String(error).slice(0, 60)})`;
            }
          }, entry.url!);
          test.info().annotations.push({ type: "#350 step 8", description: `fetch from another origin: ${result}` });
        } finally {
          await other.close();
        }
      });

      await test.step("§10 step 10: GetUilmFile keeps its contract (H10)", async () => {
        const file = await api.getFile(moduleName, language);
        expect(file.status()).toBe(200);
        expect(file.headers()["content-type"]).toContain("application/json");
        expect(file.headers()["cache-control"]).toBe("no-cache");
        const bytes = await file.body();
        expect(bytes[0], "no BOM").not.toBe(0xef);
        expect(Object.keys(JSON.parse(bytes.toString("utf8")) as object)).toContain(keyName);
      });
    });
  } finally {
    await api.dispose();
  }
});
