/**
 * Deterministic rewrites from blocks-app-next monolith component sources → client platform/ui.
 * Used by sync-platform-ui.mjs and verify-platform-ui.mjs (must stay identical).
 *
 * @param {string} content
 * @param {string} relPath posix path from repo `src/components/`, e.g. "ui-kits/input/input.tsx" or "file-uploader/x.tsx"
 */
export function transformMonolithSource(content, relPath) {
  const norm = relPath.replace(/\\/g, "/");
  let s = content;

  s = s.replace(/^["']use client["'];\r?\n\r?/m, "");

  s = s.replace(/@\/lib\/utils/g, "@/platform/ui/lib/cn");
  s = s.replace(/@\/components\/ui-kits\//g, "@/platform/ui/components/");
  s = s.replace(/@\/hooks\/use-toast/g, "@/platform/ui/hooks/use-toast");
  s = s.replace(/@\/hooks\/use-popover-width/g, "@/layouts/shell/hooks/use-popover-width");
  s = s.replace(/@\/hooks\/use-is-mobile/g, "@/layouts/shell/hooks/use-is-mobile");

  /* Monolith hooks use default exports; UILM shell hooks use named exports. */
  s = s.replace(
    /import usePopoverWidth from "@\/layouts\/shell\/hooks\/use-popover-width";/g,
    'import { usePopoverWidth } from "@/layouts/shell/hooks/use-popover-width";',
  );
  s = s.replace(
    /import useIsMobile from "@\/layouts\/shell\/hooks\/use-is-mobile";/g,
    'import { useIsMobile } from "@/layouts/shell/hooks/use-is-mobile";',
  );

  const isFileUploader = norm.startsWith("file-uploader/");
  if (isFileUploader) {
    s = s.replace(/import \{ toast \} from "sonner";\r?\n/, "");
    s = s.replace(
      /toast\.error\("file error , probably too big"\);/,
      `showErrorToast({ errors: "file error , probably too big" });`,
    );
    s = s.replace(
      /if \(rejectedFiles\[i\]\.errors\[0\]\?\.message\) \{\s*toast\.error\(rejectedFiles\[i\]\.errors\[0\]\.message\);\s*showErrorToast\(\{\s*errors: rejectedFiles\[i\]\.errors\[0\]\.message\s*\}\);/,
      `if (rejectedFiles[i].errors[0]?.message) {
              showErrorToast({
                errors: rejectedFiles[i].errors[0].message
              });`,
    );
  }

  return s;
}

/** Top-level folders under `src/components/` copied in addition to `ui-kits` contents. */
export const EXTRA_COMPONENT_TOP_LEVEL_DIRS = ["infinite-scroller", "multi-select"];
