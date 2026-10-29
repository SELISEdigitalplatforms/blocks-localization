import { useCallback, useEffect, useRef, useState } from "react";

import { useGetTranslationSuggestion } from "@blocks-localization/hooks/use-language-manager";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import {
  IAppliedTerm,
  IGlossaryViolationDto,
  ILanguageConfig,
  ITranslationSuggestionResponse,
} from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { GlossaryViolation } from "@blocks-localization/utils/glossary-validation";

export type TranslationSuggestionPayload = Parameters<
  typeof languageManagerService.getTranslationSuggestion
>[0];

export interface GlossarySuggestionInput {
  /** Identifies the row / target language; a newer request with the same key supersedes. */
  requestKey: string;
  sourceText: string;
  /** `getDefaultLanguage(languageListData)`: the source language, not the array's first item. */
  defaultLanguage?: Pick<ILanguageConfig, "languageName" | "languageCode">;
  targetLanguage: Pick<ILanguageConfig, "languageName" | "languageCode">;
  /** The key's own context (custom prompt); sent as is, or left out when empty. */
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
      /** The server's `glossaryViolations` for this output. */
      violations: GlossaryViolation[];
      appliedTerms: IAppliedTerm[];
      /** `appliedTerms` as matches: Fix uses only a Translate term's `expected` (C20). */
      matches: GlossaryMatch[];
    }
  | { status: "empty"; errors: unknown }
  | { status: "error"; error: unknown }
  | { status: "stale" };

export interface GlossarySuggestionDeps {
  requestSuggestion: (
    payload: TranslationSuggestionPayload,
  ) => Promise<ITranslationSuggestionResponse>;
  /** False once the request is superseded, cancelled or unmounted. */
  isCurrent?: () => boolean;
}

export const buildSuggestionPayload = (
  input: GlossarySuggestionInput,
): TranslationSuggestionPayload => ({
  sourceText: input.sourceText,
  destinationLanguage: input.targetLanguage.languageName || "English",
  currentLanguage: input.defaultLanguage?.languageName || "English",
  ...(input.defaultLanguage?.languageCode && {
    currentLanguageCode: input.defaultLanguage.languageCode,
  }),
  temperature: 0.1,
  elementDetailContext: input.keyContext || undefined,
  glossaryIds: input.keyGlossaryIds ?? [],
  moduleId: input.moduleId,
  destinationLanguageCode: input.targetLanguage.languageCode,
});

export const toGlossaryViolation = (violation: IGlossaryViolationDto): GlossaryViolation => ({
  glossaryId: violation.glossaryId,
  term: violation.term,
  kind: violation.kind,
  ...(violation.expected && { expected: violation.expected }),
  ...(violation.found && { found: violation.found }),
});

/**
 * An applied term as a match for Fix: only a Translate term's `expected` becomes a translation;
 * Keep and Forbidden terms carry no values, so no inactive value is ever offered (C20).
 */
export const appliedTermToMatch = (term: IAppliedTerm, targetCulture: string): GlossaryMatch => {
  const expected = term.rule === "translate" ? term.expected?.trim() : undefined;
  return {
    glossary: {
      itemId: term.glossaryId,
      name: term.term,
      rule: term.rule,
      createDate: "",
      lastUpdateDate: "",
    },
    meta: {
      rule: term.rule,
      caseSensitive: false,
      variants: [],
      translations: expected ? { [targetCulture]: expected } : {},
      forbidden: {},
    },
    definition: "",
    start: 0,
    length: 0,
    surface: term.term,
    scope: "other",
    status: "approved",
  };
};

export const runGlossaryAwareSuggestion = async (
  input: GlossarySuggestionInput,
  { requestSuggestion, isCurrent = () => true }: GlossarySuggestionDeps,
): Promise<GlossarySuggestionOutcome> => {
  const current = () => isCurrent() && !input.signal?.aborted;
  const stale = { status: "stale" } as const;

  let response: ITranslationSuggestionResponse;
  try {
    response = await requestSuggestion(buildSuggestionPayload(input));
  } catch (error) {
    return current() ? { status: "error", error } : stale;
  }
  if (!current()) return stale;
  if (!response?.content) return { status: "empty", errors: response?.errors };

  const targetCulture = input.targetLanguage.languageCode;
  const appliedTerms = response.appliedTerms ?? [];
  return {
    status: "success",
    content: response.content,
    violations: (response.glossaryViolations ?? []).map(toGlossaryViolation),
    appliedTerms,
    matches: appliedTerms.map((term) => appliedTermToMatch(term, targetCulture)),
  };
};

export const useGlossaryAwareSuggestion = () => {
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
          isCurrent,
        });
      } finally {
        if (isCurrent()) {
          tokensRef.current.delete(requestKey);
          setPending(requestKey, false);
        }
      }
    },
    [mutateAsync, setPending],
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
