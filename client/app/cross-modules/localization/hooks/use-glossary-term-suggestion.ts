import { useCallback, useEffect, useRef, useState } from "react";
import { showErrorToast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { ILanguageConfig } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";

export const TERM_SUGGESTION_DEFINITION_MAX = 300;

/** As the Phase 3 prompt sanitized it: no quotes, backticks, line breaks or `⟦⟧`; ≤ 300 chars. */
export const sanitizeDefinitionForPrompt = (definition: string | undefined): string =>
  (definition ?? "")
    .replaceAll(/["'`⟦⟧]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, TERM_SUGGESTION_DEFINITION_MAX)
    .trim();

/**
 * `GetTranslationSuggestion` for a term's own translation (A2): the name with its definition
 * as context, and no glossary ids or module, so the term's stored rules can't steer it.
 */
export const buildTermSuggestionPayload = ({
  name,
  definition,
  target,
  defaultLanguage,
}: {
  name: string;
  definition?: string;
  target: ILanguageConfig;
  defaultLanguage: ILanguageConfig;
}) => {
  const meaning = sanitizeDefinitionForPrompt(definition);
  return {
    sourceText: name.trim(),
    destinationLanguage: target.languageName,
    currentLanguage: defaultLanguage.languageName,
    temperature: 0.1,
    elementDetailContext:
      "Translate this glossary term for a software user interface. Output only the term in the target language." +
      (meaning ? ` Meaning: ${meaning}` : "") +
      "\n",
    destinationLanguageCode: target.languageCode,
  };
};

interface SuggestArgs {
  name: string;
  definition?: string;
  defaultLanguage: ILanguageConfig;
}

/**
 * Suggests term translations. Results are only returned (never saved). `suggestAll` runs one
 * request at a time; `cancel` (also on unmount) sends no further requests and ignores
 * pending results (C4).
 */
export const useGlossaryTermSuggestion = () => {
  const [pendingCodes, setPendingCodes] = useState<ReadonlySet<string>>(() => new Set());
  const generationRef = useRef(0);

  const setPending = (code: string, pending: boolean) =>
    setPendingCodes((current) => {
      const next = new Set(current);
      if (pending) next.add(code);
      else next.delete(code);
      return next;
    });

  const cancel = useCallback(() => {
    generationRef.current += 1;
    setPendingCodes(new Set());
  }, []);

  useEffect(() => cancel, [cancel]);

  const requestOne = async (
    args: SuggestArgs,
    target: ILanguageConfig,
    generation: number,
  ): Promise<string | undefined> => {
    setPending(target.languageCode, true);
    try {
      const res = await languageManagerService.getTranslationSuggestion(
        buildTermSuggestionPayload({ ...args, target }),
      );
      if (generation !== generationRef.current) return undefined;
      const value = res?.isSuccess === false ? "" : (res?.content ?? "").trim();
      if (!value) {
        showErrorToast({
          errors: res?.errors
            ? formatErrorMessage(res.errors)
            : `No suggestion for ${target.languageName}.`,
        });
        return undefined;
      }
      return value;
    } catch (error) {
      if (generation === generationRef.current) showErrorToast({ errors: formatErrorMessage(error) });
      return undefined;
    } finally {
      if (generation === generationRef.current) setPending(target.languageCode, false);
    }
  };

  const suggest = (args: SuggestArgs, target: ILanguageConfig) =>
    requestOne(args, target, generationRef.current);

  /** Sequential; `onResult` gets each value as it arrives. Stops after `cancel`. */
  const suggestAll = async (
    args: SuggestArgs,
    targets: ILanguageConfig[],
    onResult: (code: string, value: string) => void,
  ) => {
    const generation = generationRef.current;
    for (const target of targets) {
      if (generation !== generationRef.current) return;
      const value = await requestOne(args, target, generation);
      if (generation !== generationRef.current) return;
      if (value) onResult(target.languageCode, value);
    }
  };

  return { suggest, suggestAll, cancel, pendingCodes, isSuggesting: pendingCodes.size > 0 };
};
