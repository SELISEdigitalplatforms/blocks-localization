#!/usr/bin/env node
// /Glossary/Match timings (SPEC6 §5, SPEC7 §5): p95 ≤ 100 ms warm; the cold build ≤ 500 ms.
// The cold number is the first call of the run; it is a real matcher build only when the
// tenant's cache is empty (first request after a deploy, or more than 60 s after the last one —
// set PERF_COLD_WAIT_MS=65000 to wait out the TTL first).
//
//   PERF_API_BASE=… PERF_TOKEN=… PERF_LANGUAGE=en-US PERF_LABEL=after PERF_OUT=match-after.json \
//     node scripts/perf/glossary-match.mjs
//
// Optional: PERF_LANGUAGE (source culture, default en-US), PERF_MODULE_ID, PERF_KEY_ID,
// PERF_MATCH_TEXT (default: a short UI string), PERF_COLD_WAIT_MS.
import { measure, readConfig, report, timeRequest } from "./perf-lib.mjs";

const config = readConfig();
const language = process.env.PERF_LANGUAGE ?? "en-US";
const coldWait = Number(process.env.PERF_COLD_WAIT_MS ?? 0);
const short = process.env.PERF_MATCH_TEXT ?? "Open your workspace and invite your team to the dashboard";
const long = Array.from({ length: 20 }, () => short).join(". ");
const icu = "{count, plural, one {# workspace} other {# workspaces}} in {role, select, admin {Admin panel} other {Panel}}";

const body = (text) => ({
  text,
  language,
  ...(process.env.PERF_MODULE_ID && { moduleId: process.env.PERF_MODULE_ID }),
  ...(process.env.PERF_KEY_ID && { keyId: process.env.PERF_KEY_ID }),
});

if (coldWait > 0) {
  console.log(`Waiting ${coldWait} ms so the matcher cache entry expires…`);
  await new Promise((resolve) => setTimeout(resolve, coldWait));
}
const cold = await timeRequest(config, { method: "POST", path: "/Glossary/Match", body: body(short) });
const matchCount = JSON.parse(cold.text)?.matches?.length ?? 0;
console.log(`cold build (first call)                      ${Math.round(cold.elapsed * 10) / 10} ms  (budget 500 ms) — ${matchCount} matches`);

const results = [
  {
    name: "Match cold (first call)",
    calls: 1,
    coldMs: Math.round(cold.elapsed * 10) / 10,
    p50Ms: null,
    p95Ms: null,
    maxMs: null,
    budgetP95Ms: 500,
    withinBudget: coldWait > 0 ? cold.elapsed <= 500 : null,
  },
  await measure(config, "Match short text (warm)", { method: "POST", path: "/Glossary/Match", body: body(short) }, 100),
  await measure(config, "Match 20 sentences (warm)", { method: "POST", path: "/Glossary/Match", body: body(long) }, 100),
  await measure(config, "Match ICU plural/select (warm)", { method: "POST", path: "/Glossary/Match", body: body(icu) }, 100),
];
report(config, "glossary-match", results);
