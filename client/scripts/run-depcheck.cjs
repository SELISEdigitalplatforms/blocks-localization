"use strict";

/**
 * Runs depcheck with default parsers plus Tailwind v4 CSS (`@import` / `@plugin`).
 * Reads `ignores` from `.depcheckrc.json` in the package root.
 */
const path = require("path");
const fs = require("fs");
const depcheck = require("depcheck");
const { defaultOptions } = require("depcheck/dist/constants");
const parseTailwindV4Css = require("./depcheck-tailwind-v4-css-parser.cjs");

const rootDir = path.resolve(__dirname, "..");
const rcPath = path.join(rootDir, ".depcheckrc.json");
const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
const ignoreMatches = rc.ignores || [];

const parsers = {
  ...defaultOptions.parsers,
  "**/*.css": parseTailwindV4Css,
};

depcheck(rootDir, {
  ignoreMatches,
  ignorePatterns: defaultOptions.ignorePatterns,
  parsers,
  detectors: defaultOptions.detectors,
  specials: defaultOptions.specials,
  skipMissing: false,
}).then((result) => {
  const hasIssue =
    result.dependencies.length > 0 ||
    result.devDependencies.length > 0 ||
    Object.keys(result.missing).length > 0;

  if (!hasIssue) {
    console.log("No depcheck issue");
    process.exit(0);
  }

  if (result.dependencies.length) {
    console.log("Unused dependencies");
    result.dependencies.forEach((d) => console.log(`* ${d}`));
  }
  if (result.devDependencies.length) {
    console.log("Unused devDependencies");
    result.devDependencies.forEach((d) => console.log(`* ${d}`));
  }
  if (Object.keys(result.missing).length) {
    console.log("Missing dependencies");
    Object.entries(result.missing).forEach(([dep, files]) => {
      console.log(`* ${dep}: ${files[0]}`);
    });
  }
  process.exitCode = -1;
});
