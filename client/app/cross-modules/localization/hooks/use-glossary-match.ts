import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";

import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { IGlossaryMatchDto } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { getGlossaryStatus, toGlossaryMeta } from "@blocks-localization/utils/glossary-display";
import { stripRuleMarker } from "@blocks-localization/utils/glossary-rule-marker";

export const MATCH_MAX_TEXT_LENGTH = 5000;
export const MATCH_STALE_TIME = 5 * 60_000;
/** Editable sources (inline editor, new key) match 300 ms after typing stops (C18). */
export const MATCH_DEBOUNCE_MS = 300;

const NO_MATCHES: GlossaryMatch[] = [];

export const toGlossaryMatch = (dto: IGlossaryMatchDto): GlossaryMatch => {
  const definition = stripRuleMarker(dto.definition);
  const status = getGlossaryStatus(dto);
  return {
    glossary: {
      itemId: dto.glossaryId,
      name: dto.term,
      context: definition,
      rule: dto.rule,
      caseSensitive: dto.caseSensitive,
      translations: dto.translations ?? [],
      status,
      partOfSpeech: dto.partOfSpeech,
      usageExamples: dto.usageExamples,
      createDate: "",
      lastUpdateDate: "",
    },
    meta: toGlossaryMeta({
      rule: dto.rule,
      caseSensitive: dto.caseSensitive,
      translations: dto.translations,
    }),
    definition,
    start: dto.start,
    length: dto.length,
    surface: dto.surface,
    scope: dto.scope,
    status,
  };
};

export interface UseGlossaryMatchOptions {
  /** The (debounced, for editable sources) source text. */
  text: string;
  sourceCulture: string;
  keyId?: string;
  moduleId?: string;
  /** The key's tags; sent for unsaved keys (with `keyId` the server reads the stored tags). */
  glossaryIds?: string[];
  enabled?: boolean;
}

export const isMatchableText = (text: string) =>
  text.trim().length > 0 && text.length <= MATCH_MAX_TEXT_LENGTH;

export const useGlossaryMatch = ({
  text,
  sourceCulture,
  keyId,
  moduleId,
  glossaryIds,
  enabled = true,
}: UseGlossaryMatchOptions) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const ids = (glossaryIds ?? []).filter(Boolean);
  const idsKey = ids.join(",");
  const isEnabled = enabled && !!tenantId && !!sourceCulture && isMatchableText(text);
  const query = useQuery({
    queryKey: localizationQueryKeys.glossaries.match(
      tenantId,
      sourceCulture,
      keyId ?? "",
      moduleId ?? "",
      text,
      idsKey,
    ),
    queryFn: async ({ signal }) => {
      const response = await languageManagerService.matchGlossary(
        {
          text,
          language: sourceCulture,
          ...(keyId && { keyId }),
          ...(moduleId && { moduleId }),
          ...(ids.length > 0 && { glossaryIds: ids }),
        },
        { signal },
      );
      return { text, matches: response?.matches ?? [] };
    },
    enabled: isEnabled,
    staleTime: MATCH_STALE_TIME,
    gcTime: MATCH_STALE_TIME,
    placeholderData: keepPreviousData,
    // Failures render plain text, without a toast (C2).
    retry: false,
  });

  const data = isEnabled && !query.isError ? query.data : undefined;
  const matches = useMemo(
    () => (data?.matches.length ? data.matches.map(toGlossaryMatch) : NO_MATCHES),
    [data],
  );

  return {
    matches,
    isLoading: query.isLoading,
    isError: query.isError,
    /** The text `matches` belong to (`undefined` until a response arrived). */
    matchedText: data?.text,
  };
};
