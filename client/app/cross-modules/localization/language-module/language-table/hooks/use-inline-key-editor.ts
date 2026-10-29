import { useCallback, useMemo, useState } from "react";
import { useGlossarySuggestionRows } from "@blocks-localization/components/glossary/glossary-violation-list";
import { useLoadAllGlossaries } from "@blocks-localization/hooks/use-glossary-aware-suggestion";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import {
  LIVE_CHECK_DEBOUNCE_MS,
  useApplicableGlossaryMatches,
  useDebouncedValue,
  useLoadedGlossaries,
} from "@blocks-localization/hooks/use-live-glossary-check";
import type { GlossaryViolation } from "@blocks-localization/utils/glossary-validation";
import type { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";
import { toast } from "@/hooks/use-toast";

const getTranslationValues = (
  keyDetails: IBlocksLanguageKey,
  languages: Pick<ILanguageConfig, "languageCode">[],
) =>
  Object.fromEntries(
    languages.map((language) => [
      language.languageCode,
      keyDetails.resources?.find((resource) => resource.culture === language.languageCode)?.value ??
        "",
    ]),
  );

export const useInlineKeyEditor = (
  keyDetails: IBlocksLanguageKey,
  languageListData: ILanguageConfig[],
) => {
  const { isPending: isSaving, mutateAsync: saveKeyAsync } = useSaveBlocksLanguageKey();
  const loadGlossaries = useLoadAllGlossaries();
  // Per-language suggestion state; unmounting (row collapsed) drops in-flight responses (C22).
  const {
    request,
    isPending: isAutoTranslating,
    getRow: getGlossaryRow,
    clearViolations,
    fix,
  } = useGlossarySuggestionRows({ loadGlossaries });
  const sortedLanguages = useMemo(
    () => [...languageListData].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [languageListData],
  );
  const [draftTranslations, setDraftTranslations] = useState<Record<string, string>>(() =>
    getTranslationValues(keyDetails, languageListData),
  );
  const [savedTranslations, setSavedTranslations] = useState<Record<string, string>>(() =>
    getTranslationValues(keyDetails, languageListData),
  );

  const changedCultures = sortedLanguages
    .map((language) => language.languageCode)
    .filter((culture) => draftTranslations[culture] !== savedTranslations[culture]);
  const hasChanges = changedCultures.length > 0;
  const hasEmptyChange = changedCultures.some((culture) => !draftTranslations[culture]?.trim());

  const setDraftTranslation = (culture: string, value: string) => {
    setDraftTranslations((current) => ({ ...current, [culture]: value }));
  };

  /** A user edit: the suggestion's violation list gives way to the live check. */
  const setTranslation = useCallback(
    (culture: string, value: string) => {
      setDraftTranslations((current) => ({ ...current, [culture]: value }));
      clearViolations(culture);
    },
    [clearViolations],
  );

  // Each target row's glossary checklist follows the editable default-language draft.
  const defaultLanguage =
    sortedLanguages.find((language) => language.isDefault) ?? sortedLanguages[0];
  const glossaries = useLoadedGlossaries(loadGlossaries);
  const debouncedSource = useDebouncedValue(
    draftTranslations[defaultLanguage?.languageCode ?? ""] ?? "",
    LIVE_CHECK_DEBOUNCE_MS,
  );
  const sourceMatches = useApplicableGlossaryMatches(glossaries, debouncedSource, {
    sourceCulture: defaultLanguage?.languageCode ?? "",
    keyGlossaryIds: keyDetails.glossaryIds,
    moduleId: keyDetails.moduleId,
  });
  const discardChanges = () => {
    setDraftTranslations({ ...savedTranslations });
    clearViolations();
  };

  /** A live Fix result is a user edit of the row. */
  const applyLiveFix = (culture: string, fixed: string) => setTranslation(culture, fixed);

  const fixViolation = (culture: string, violation: GlossaryViolation) => {
    const fixed = fix(culture, violation, draftTranslations[culture] ?? "");
    if (fixed !== null) setDraftTranslation(culture, fixed);
  };

  const saveChanges = async () => {
    const resources = (keyDetails.resources ?? []).map((resource) => ({ ...resource }));

    changedCultures.forEach((culture) => {
      const resourceIndex = resources.findIndex((resource) => resource.culture === culture);
      const value = draftTranslations[culture];
      if (resourceIndex === -1) {
        resources.push({ culture, value });
      } else {
        resources[resourceIndex].value = value;
      }
    });

    try {
      const response = await saveKeyAsync({
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources,
        routes: keyDetails.routes ?? [],
        glossaryIds: keyDetails.glossaryIds,
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        context: keyDetails.context,
      });

      if (response?.success) {
        setSavedTranslations({ ...draftTranslations });
        toast({
          variant: "success",
          title: "Success",
          description: "Language key updated successfully",
        });
        return;
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(response?.errorMessage),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  const autoTranslate = async (destinationLanguageCode: string) => {
    const destinationLanguage = sortedLanguages.find(
      (language) => language.languageCode === destinationLanguageCode,
    );

    if (!defaultLanguage || !destinationLanguage) return;

    const sourceText = draftTranslations[defaultLanguage.languageCode] ?? "";
    const outcome = await request({
      requestKey: destinationLanguageCode,
      legacyPayload: {
        sourceText,
        destinationLanguage: destinationLanguage.languageName || "English",
        currentLanguage: defaultLanguage.languageName || "English",
        temperature: 0.1,
        glossaryIds: keyDetails.glossaryIds,
        moduleId: keyDetails.moduleId,
        destinationLanguageCode,
      },
      sourceText,
      defaultLanguage,
      targetLanguage: destinationLanguage,
      keyContext: keyDetails.context,
      keyGlossaryIds: keyDetails.glossaryIds,
      moduleId: keyDetails.moduleId,
    });
    if (outcome.status === "stale") return;
    if (outcome.status === "success") {
      setDraftTranslation(destinationLanguageCode, outcome.content);
      toast({
        variant: "success",
        title: "Success",
        description: "Translated successfully",
      });
      return;
    }
    toast({
      variant: "destructive",
      title: "Error",
      description: JSON.stringify(outcome.status === "empty" ? outcome.errors : outcome.error),
    });
  };

  return {
    applyLiveFix,
    autoTranslate,
    discardChanges,
    draftTranslations,
    fixViolation,
    getGlossaryRow,
    hasChanges,
    hasEmptyChange,
    isAutoTranslating,
    isSaving,
    saveChanges,
    setTranslation,
    sortedLanguages,
    sourceMatches,
  };
};
