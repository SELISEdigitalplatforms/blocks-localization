// Shared helpers for the glossary API timing scripts (SPEC15 §5, EV16). Node 20+, no dependencies.
import { writeFileSync } from "node:fs";

export function readConfig() {
  const apiBase = process.env.PERF_API_BASE?.replace(/\/$/, "");
  const token = process.env.PERF_TOKEN;
  if (!apiBase || !token) {
    console.error(
      [
        "Set PERF_API_BASE and PERF_TOKEN.",
        "  PERF_API_BASE  the localization API base the console calls, up to (not incl.) /Glossary",
        "                 (copy it from a Key/Gets request in the browser's network tab)",
        "  PERF_TOKEN     bearer token of the E2E session (Authorization header, without 'Bearer ')",
        "Optional:",
        "  PERF_HEADERS   JSON of extra headers the console sends, e.g. '{\"x-blocks-key\":\"…\"}'",
        "  PERF_REPEATS   measured calls per case (default 30)",
        "  PERF_WARMUP    unmeasured warm-up calls per case (default 3)",
        "  PERF_LABEL     run label for the report, e.g. 'before-1d6a785c' or 'after'",
        "  PERF_OUT       write the JSON report to this file",
      ].join("\n"),
    );
    process.exit(2);
  }
  let extra = {};
  if (process.env.PERF_HEADERS) extra = JSON.parse(process.env.PERF_HEADERS);
  return {
    apiBase,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra },
    repeats: Number(process.env.PERF_REPEATS ?? 30),
    warmup: Number(process.env.PERF_WARMUP ?? 3),
    label: process.env.PERF_LABEL ?? "",
    out: process.env.PERF_OUT,
  };
}

const percentile = (sorted, p) =>
  sorted.length === 0 ? NaN : sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

const round = (value) => Math.round(value * 10) / 10;

/** Times one request; throws on a non-2xx answer so a broken case can't pass as fast. */
export async function timeRequest(config, { method = "GET", path, body }) {
  const started = performance.now();
  const response = await fetch(`${config.apiBase}${path}`, {
    method,
    headers: config.headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const elapsed = performance.now() - started;
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${text.slice(0, 200)}`);
  return { elapsed, text };
}

/** First call (cold for this client and possibly the server cache), warm-up, then `repeats`. */
export async function measure(config, name, request, budgetMs) {
  const cold = (await timeRequest(config, request)).elapsed;
  for (let i = 0; i < config.warmup; i++) await timeRequest(config, request);
  const samples = [];
  for (let i = 0; i < config.repeats; i++) samples.push((await timeRequest(config, request)).elapsed);
  const sorted = [...samples].sort((a, b) => a - b);
  const result = {
    name,
    calls: samples.length,
    coldMs: round(cold),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(percentile(sorted, 95)),
    maxMs: round(sorted.at(-1)),
    budgetP95Ms: budgetMs ?? null,
    withinBudget: budgetMs === undefined ? null : percentile(sorted, 95) <= budgetMs,
  };
  console.log(
    `${name.padEnd(44)} cold ${String(result.coldMs).padStart(7)} ms  p50 ${String(result.p50Ms).padStart(7)} ms  p95 ${String(result.p95Ms).padStart(7)} ms${
      budgetMs === undefined ? "" : `  budget ${budgetMs} ms ${result.withinBudget ? "ok" : "OVER"}`
    }`,
  );
  return result;
}

export function report(config, script, results) {
  const output = {
    script,
    label: config.label,
    apiBase: config.apiBase,
    at: new Date().toISOString(),
    node: process.version,
    repeats: config.repeats,
    warmup: config.warmup,
    note: "Client-side round-trip times (network included). Compare before/after on the same machine and dev resources.",
    results,
  };
  if (config.out) {
    writeFileSync(config.out, JSON.stringify(output, null, 2));
    console.log(`\nReport written to ${config.out}`);
  }
  if (results.some((result) => result.withinBudget === false)) process.exitCode = 1;
  return output;
}
