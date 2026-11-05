#!/usr/bin/env node
// Glossary/Gets (with the SPEC8 filters and sort), Glossary/Usage and Glossary/GetByIds timings.
// Budget: Gets with filters p95 ≤ Phase 5 baseline + 10 % (SPEC15 §5). Pass the baseline report
// from the "before" run as PERF_BASELINE to compare; without it the numbers are only recorded.
//
//   PERF_API_BASE=… PERF_TOKEN=… PERF_LABEL=before-1d6a785c PERF_OUT=before.json \
//     node scripts/perf/glossary-queries.mjs
//
// Optional: PERF_GLOSSARY_ID (a glossary for Usage/GetByIds), PERF_LANGUAGE (default en-US),
// PERF_SEARCH (default "work"), PERF_BASELINE (path to an earlier report of this script).
import { readFileSync } from "node:fs";
import { measure, readConfig, report } from "./perf-lib.mjs";

const config = readConfig();
const language = process.env.PERF_LANGUAGE ?? "en-US";
const search = process.env.PERF_SEARCH ?? "work";
const glossaryId = process.env.PERF_GLOSSARY_ID;
const baseline = process.env.PERF_BASELINE
  ? JSON.parse(readFileSync(process.env.PERF_BASELINE, "utf8"))
  : null;

const gets = (params) =>
  `/Glossary/Gets?${new URLSearchParams({ PageNumber: "0", PageSize: "20", ...params })}`;

const cases = [
  ["Gets page 0", gets({})],
  ["Gets SearchText", gets({ SearchText: search })],
  ["Gets Rule=translate", gets({ Rule: "translate" })],
  ["Gets Status=draft", gets({ Status: "draft" })],
  ["Gets Language", gets({ Language: language })],
  ["Gets Scope=project", gets({ Scope: "project" })],
  ["Gets SortBy=name", gets({ SortBy: "name", SortDescending: "false" })],
  ["Gets all filters + sort", gets({ Rule: "translate", Status: "approved", Scope: "project", SortBy: "name", SortDescending: "false" })],
  ["Gets PageSize=100", gets({ PageSize: "100" })],
];

const budgetFor = (name) => {
  const before = baseline?.results?.find((result) => result.name === name);
  return before ? Math.round(before.p95Ms * 1.1 * 10) / 10 : undefined;
};

const results = [];
for (const [name, path] of cases) {
  results.push(await measure(config, name, { path }, budgetFor(name)));
}
if (glossaryId) {
  const id = encodeURIComponent(glossaryId);
  results.push(
    await measure(config, "Usage pageSize=1", { path: `/Glossary/Usage?itemId=${id}&pageNumber=0&pageSize=1` }, budgetFor("Usage pageSize=1")),
    await measure(config, "GetByIds 1 id", { path: `/Glossary/GetByIds?itemIds=${id}` }, budgetFor("GetByIds 1 id")),
  );
} else {
  console.log("(PERF_GLOSSARY_ID not set: Usage and GetByIds skipped)");
}
report(config, "glossary-queries", results);
