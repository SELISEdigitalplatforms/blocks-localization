import { useLocation } from "react-router-dom";
import { BREADCRUMB_CUSTOM_TITLES, BREADCRUMB_SKIP_PATHS } from "@/constants/breadcrumb-custom-title";

const useRoutePathSegments = () => {
  const { pathname } = useLocation();
  const pathArray = pathname.split("/").filter((path) => path);

  const breadcrumbs = pathArray.map((path, index) => {
    const href = "/" + pathArray.slice(0, index + 1).join("/");
    return {
      href,
      label: formateLabel(path),
    };
  });

  // Apply custom titles with pattern matching for dynamic segments
  const filteredBreadcrumbs = breadcrumbs.filter(
    (breadcrumb) => !BREADCRUMB_SKIP_PATHS.includes(breadcrumb.href)
  );

  return filteredBreadcrumbs.map((breadcrumb) => {
    // Direct match first
    if (BREADCRUMB_CUSTOM_TITLES[breadcrumb.href] !== undefined) {
      return {
        ...breadcrumb,
        label: BREADCRUMB_CUSTOM_TITLES[breadcrumb.href] ?? breadcrumb.label,
      };
    }
    // Pattern match: check if any pattern key matches this href
    for (const [pattern, title] of Object.entries(BREADCRUMB_CUSTOM_TITLES)) {
      if (pattern !== breadcrumb.href && matchDynamicPath(pattern, breadcrumb.href)) {
        return { ...breadcrumb, label: title ?? breadcrumb.label };
      }
    }
    return breadcrumb;
  });
};

// Match paths like /services/glossary/:itemId against /services/glossary/abc123
// or /services/language/translations/:keyId against /services/language/translations/abc123
const matchDynamicPath = (pattern: string, actual: string): boolean => {
  const patternParts = pattern.split("/").filter(Boolean);
  const actualParts = actual.split("/").filter(Boolean);
  if (patternParts.length !== actualParts.length) return false;
  return patternParts.every((part, i) => {
    // Support :paramName placeholders in pattern (e.g., :keyId, :itemId)
    if (part.startsWith(":")) return true;
    // UUID/itemId pattern: alphanumeric with dashes (min 5 chars to avoid false positives)
    if (/^[a-zA-Z0-9-]{5,}$/.test(actualParts[i])) return true;
    return part === actualParts[i];
  });
};

const formateLabel = (label: string): string => {
  const words = label.split("-");
  const formattedWords = words.map((word) => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return formattedWords.join(" ");
};

export default useRoutePathSegments;
