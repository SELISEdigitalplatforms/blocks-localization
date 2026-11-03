/**
 * Glossary-aware single-key AI suggestions.
 *
 * - `useGetAllGlossaries()`: the project's whole glossary (paged by 500, 5 min cache).
 *   Call it to warm the cache; it needs a QueryClientProvider.
 * - `useLoadAllGlossaries()`: `() => Promise<IGlossary[]>` reading the same cache entry
 *   (fetches when missing or stale). Pass it to `useGlossaryAwareSuggestion`.
 * - `useGlossaryAwareSuggestion({ loadGlossaries })` → `{ suggest, cancel, isPending, pendingKeys }`.
 *   `suggest({ requestKey, legacyPayload, ... })` runs one user-initiated suggestion for one
 *   target language (≤ 2 AI calls) and resolves to an outcome:
 *     - `success`: `{ content, violations, matches, usedGlossary, glossaryUnavailable }`
 *     - `empty` (call 1 had no content) / `error` (call 1 threw): show the existing error toast
 *     - `stale`: superseded by a newer `suggest` with the same `requestKey`, cancelled, aborted
 *       through `signal`, or the component unmounted (C22). Ignore it.
 *   Glossary load failure: sends `legacyPayload` and sets `glossaryUnavailable` (C6).
 * The hook itself uses no query, so it also works in components rendered without a
 * QueryClientProvider when the caller passes its own `loadGlossaries`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";

import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";
import { useGetTranslationSuggestion } from "@blocks-localization/hooks/use-language-manager";
import { IGlossary, ILanguageConfig } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { buildGlossaryMatcher, GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";
import {
  buildCorrectionPrompt,
  GlossaryViolation,
  validateTranslation,
} from "@blocks-localization/utils/glossary-validation";
import { buildTranslationPromptWithRules } from "@blocks-localization/utils/translation-prompt";

export const ALL_GLOSSARIES_PAGE_SIZE = 500;
export const ALL_GLOSSARIES_MAX_PAGES = 20;
export const ALL_GLOSSARIES_STALE_TIME = 5 * 60_000;

export const GLOSSARY_UNAVAILABLE_MESSAGE =
  "Glossary unavailable; suggestion made without terminology rules.";

/**
 * Pages `Glossary/Gets` until `totalCount` is reached, a page is short, or 20 pages (C13).
 * De-duplicates by itemId (first wins): the server sort has no tie-breaker (C19).
 */
export const fetchAllGlossaries = async (): Promise<IGlossary[]> => {
  const byId = new Map<string, IGlossary>();
  let loaded = 0;
  for (let pageNumber = 0; pageNumber < ALL_GLOSSARIES_MAX_PAGES; pageNumber++) {
    const page = await languageManagerService.fetchGlossaries({
      pageNumber,
      pageSize: ALL_GLOSSARIES_PAGE_SIZE,
    });
    const items = page?.items ?? [];
    for (const item of items) {
      if (!byId.has(item.itemId)) byId.set(item.itemId, item);
    }
    loaded += items.length;
    if (items.length < ALL_GLOSSARIES_PAGE_SIZE || loaded >= (page?.totalCount ?? 0)) break;
  }
  return [...byId.values()];
};

const allGlossariesQuery = (tenantId: string) => ({
  queryKey: localizationQueryKeys.glossaries.allTerms(tenantId),
  queryFn: fetchAllGlossaries,
  staleTime: ALL_GLOSSARIES_STALE_TIME,
});

export const useGetAllGlossaries = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({ ...allGlossariesQuery(tenantId), enabled: !!tenantId });
};

/** Resolves the full glossary from the shared cache, fetching it when missing or stale. */
export const useLoadAllGlossaries = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const queryClient = useQueryClient();
  return useCallback(async () => {
    if (!tenantId) throw new Error("No project selected");
    return queryClient.query(allGlossariesQuery(tenantId));
  }, [queryClient, tenantId]);
};

export type TranslationSuggestionPayload = Parameters<
  typeof languageManagerService.getTranslationSuggestion
>[0];

type TranslationSuggestionResponse = Awaited<
  ReturnType<typeof languageManagerService.getTranslationSuggestion>
>;

export interface GlossarySuggestionInput {
  /** Identifies the row / target language; a newer request with the same key supersedes. */
  requestKey: string;
  /** The payload without terminology rules, sent unchanged when the glossary is unavailable (C6). */
  legacyPayload: TranslationSuggestionPayload;
  /** Source text in the default language. */
  sourceText: string;
  /** `getDefaultLanguage(languageListData)`; its code is the source culture. */
  defaultLanguage?: Pick<ILanguageConfig, "languageName" | "languageCode">;
  targetLanguage: Pick<ILanguageConfig, "languageName" | "languageCode">;
  /** The key's custom prompt (edit/inline: `keyDetails.context`; new key: form context). */
  keyContext?: string;
  keyGlossaryIds?: string[];
  moduleId?: string;
  /** Aborting makes the outcome `stale`. */
  signal?: AbortSignal;
}

export type GlossarySuggestionOutcome =
  | {
      status: "success";
      content: string;
      violations: GlossaryViolation[];
      /** The matches whose rules were sent and validated (Fix re-validates against these). */
      matches: GlossaryMatch[];
      /** True when the terminology prompt was sent. */
      usedGlossary: boolean;
      /** C6: the glossary failed to load and the legacy payload was sent. */
      glossaryUnavailable: boolean;
      /** AI requests made (1 or 2). */
      requestCount: number;
    }
  | { status: "empty"; errors: unknown; glossaryUnavailable: boolean }
  | { status: "error"; error: unknown; glossaryUnavailable: boolean }
  | { status: "stale" };

export interface GlossarySuggestionDeps {
  requestSuggestion: (
    payload: TranslationSuggestionPayload,
  ) => Promise<TranslationSuggestionResponse>;
  loadGlossaries?: () => Promise<IGlossary[]>;
  /** False once the request is superseded, cancelled or unmounted. */
  isCurrent?: () => boolean;
}

/** The terminology payload for the first call; matches are already scoped by the client. */
const buildGlossaryPayload = (
  input: GlossarySuggestionInput,
  matches: GlossaryMatch[],
): { payload: TranslationSuggestionPayload; prompt: string; ruleGlossaryIds: string[] } => {
  const targetCulture = input.targetLanguage.languageCode;
  const { prompt, ruleGlossaryIds } = buildTranslationPromptWithRules({
    keyContext: input.keyContext,
    matches,
    targetCulture,
  });
  const payload: TranslationSuggestionPayload = {
    sourceText: input.sourceText,
    destinationLanguage: input.targetLanguage.languageName || "English",
    currentLanguage: input.defaultLanguage?.languageName || "English",
    temperature: 0.1,
    elementDetailContext: prompt,
    // The client already applied key and module scope; moduleId is omitted on purpose.
    glossaryIds: [],
    destinationLanguageCode: targetCulture,
    // Only when rules were sent: the client then validates and retries itself.
    ...(ruleGlossaryIds.length > 0 && { clientGlossaryRules: true }),
  };
  return { payload, prompt, ruleGlossaryIds };
};

/** Resolves the glossary, or `{ ok: false }` when there is no loader or it failed (C6). */
const tryLoadGlossaries = async (
  loadGlossaries: GlossarySuggestionDeps["loadGlossaries"],
): Promise<{ ok: true; glossaries: IGlossary[] } | { ok: false }> => {
  if (!loadGlossaries) return { ok: false };
  try {
    return { ok: true, glossaries: await loadGlossaries() };
  } catch {
    return { ok: false };
  }
};

/** The single correction retry (H6); a failed or empty retry keeps `fallback` (C5). */
const retryWithCorrection = async (
  requestSuggestion: GlossarySuggestionDeps["requestSuggestion"],
  payload: TranslationSuggestionPayload,
  correctionPrompt: string,
  fallback: string,
): Promise<string> => {
  try {
    const retry = await requestSuggestion({ ...payload, elementDetailContext: correctionPrompt });
    return retry?.content || fallback;
  } catch {
    return fallback;
  }
};

/** Sends the legacy payload unchanged when the glossary is unavailable (C6). */
const runLegacySuggestion = async (
  legacyPayload: TranslationSuggestionPayload,
  requestSuggestion: GlossarySuggestionDeps["requestSuggestion"],
  current: () => boolean,
  glossaryUnavailable: boolean,
): Promise<GlossarySuggestionOutcome> => {
  try {
    const response = await requestSuggestion(legacyPayload);
    if (!current()) return { status: "stale" };
    if (!response?.content) {
      return { status: "empty", errors: response?.errors, glossaryUnavailable };
    }
    return {
      status: "success",
      content: response.content,
      violations: [],
      matches: [],
      usedGlossary: false,
      glossaryUnavailable,
      requestCount: 1,
    };
  } catch (error) {
    return current() ? { status: "error", error, glossaryUnavailable } : { status: "stale" };
  }
};

/** The suggestion pipeline without React state (spec §6 Payload and Retry). */
export const runGlossaryAwareSuggestion = async (
  input: GlossarySuggestionInput,
  { requestSuggestion, loadGlossaries, isCurrent = () => true }: GlossarySuggestionDeps,
): Promise<GlossarySuggestionOutcome> => {
  const current = () => isCurrent() && !input.signal?.aborted;
  const stale = { status: "stale" } as const;

  const loaded = await tryLoadGlossaries(loadGlossaries);
  if (!current()) return stale;
  if (!loaded.ok) return runLegacySuggestion(input.legacyPayload, requestSuggestion, current, true);

  const targetCulture = input.targetLanguage.languageCode;
  const matches = buildGlossaryMatcher(loaded.glossaries).match(input.sourceText, {
    scopeMode: "applicable",
    sourceCulture: input.defaultLanguage?.languageCode ?? "",
    keyGlossaryIds: input.keyGlossaryIds,
    moduleId: input.moduleId,
  });
  const { payload, prompt, ruleGlossaryIds } = buildGlossaryPayload(input, matches);
  // Only rules that were sent are checked; the caps may have dropped some (m2).
  const sentIds = new Set(ruleGlossaryIds);
  const checkedMatches = matches.filter((match) => sentIds.has(match.glossary.itemId));

  let first: TranslationSuggestionResponse;
  try {
    first = await requestSuggestion(payload);
  } catch (error) {
    return current() ? { status: "error", error, glossaryUnavailable: false } : stale;
  }
  if (!current()) return stale;
  if (!first?.content)
    return { status: "empty", errors: first?.errors, glossaryUnavailable: false };

  const success = (content: string, violations: GlossaryViolation[], requestCount: number) =>
    ({
      status: "success",
      content,
      violations,
      matches: checkedMatches,
      usedGlossary: true,
      glossaryUnavailable: false,
      requestCount,
    }) as const;

  // No matched term: nothing to check, never retry (C7).
  if (matches.length === 0) return success(first.content, [], 1);

  const firstViolations = validateTranslation(first.content, checkedMatches, targetCulture);
  if (firstViolations.length === 0) return success(first.content, [], 1);

  // Exactly one retry (H6); a failed or empty retry keeps the first output (C5).
  const content = await retryWithCorrection(
    requestSuggestion,
    payload,
    buildCorrectionPrompt(prompt, firstViolations),
    first.content,
  );
  if (!current()) return stale;
  return success(content, validateTranslation(content, checkedMatches, targetCulture), 2);
};

export interface UseGlossaryAwareSuggestionOptions {
  /** From `useLoadAllGlossaries()`, or a parent's loader passed down as a prop. */
  loadGlossaries?: () => Promise<IGlossary[]>;
}

export const useGlossaryAwareSuggestion = ({
  loadGlossaries,
}: UseGlossaryAwareSuggestionOptions = {}) => {
  const { mutateAsync } = useGetTranslationSuggestion();
  const tokensRef = useRef(new Map<string, number>());
  const counterRef = useRef(0);
  const mountedRef = useRef(true);
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set());

  const setPending = useCallback((key: string, pending: boolean) => {
    setPendingKeys((previous) => {
      if (previous.has(key) === pending) return previous;
      const next = new Set(previous);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const tokens = tokensRef.current;
    return () => {
      mountedRef.current = false;
      tokens.clear();
    };
  }, []);

  const suggest = useCallback(
    async (input: GlossarySuggestionInput): Promise<GlossarySuggestionOutcome> => {
      const { requestKey } = input;
      const token = ++counterRef.current;
      tokensRef.current.set(requestKey, token);
      setPending(requestKey, true);
      const isCurrent = () => mountedRef.current && tokensRef.current.get(requestKey) === token;
      try {
        return await runGlossaryAwareSuggestion(input, {
          requestSuggestion: mutateAsync,
          loadGlossaries,
          isCurrent,
        });
      } finally {
        if (isCurrent()) {
          tokensRef.current.delete(requestKey);
          setPending(requestKey, false);
        }
      }
    },
    [loadGlossaries, mutateAsync, setPending],
  );

  /** Drops the in-flight request for one key (row collapsed), or all of them. */
  const cancel = useCallback(
    (requestKey?: string) => {
      if (requestKey === undefined) {
        tokensRef.current.clear();
        setPendingKeys((previous) => (previous.size === 0 ? previous : new Set()));
        return;
      }
      tokensRef.current.delete(requestKey);
      setPending(requestKey, false);
    },
    [setPending],
  );

  const isPending = useCallback((requestKey: string) => pendingKeys.has(requestKey), [pendingKeys]);

  return { suggest, cancel, isPending, pendingKeys };
};
