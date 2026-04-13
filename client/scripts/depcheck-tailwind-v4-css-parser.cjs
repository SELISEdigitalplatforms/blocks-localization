"use strict";

/**
 * Depcheck parser for Tailwind CSS v4 stylesheets: `@import "…"` and `@plugin "…"`.
 * Returns package names so deps used only in CSS are attributed (not ignored).
 */
const fs = require("fs");

/** Map a specifier to npm package name (no extra deps — avoids missing `require-package-name`). */
function specifierToPackageName(spec) {
  const trimmed = spec.trim();
  if (!trimmed || trimmed.startsWith("./") || trimmed.startsWith("../")) return null;
  if (trimmed.startsWith("@")) {
    const parts = trimmed.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : trimmed;
  }
  return trimmed.split("/")[0] || null;
}

function parseTailwindV4Css(filename) {
  const content = fs.readFileSync(filename, "utf8");
  const deps = [];
  const patterns = [/@import\s+["']([^"']+)["']/g, /@plugin\s+["']([^"']+)["']/g];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const pkg = specifierToPackageName(m[1]);
      if (pkg) deps.push(pkg);
    }
  }
  return [...new Set(deps)];
}

module.exports = parseTailwindV4Css;
