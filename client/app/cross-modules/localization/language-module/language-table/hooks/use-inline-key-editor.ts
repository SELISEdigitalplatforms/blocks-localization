import { useMemo, useState } from "react";
import {
  useGetTranslationSuggestion,
  useSaveBlocksLanguageKey,
} from "@blocks-localization/hooks/use-language-manager";
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
  const { isPending: isAutoTranslating, mutateAsync: suggestTranslationAsync } =
    useGetTranslationSuggestion();
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

  const setTranslation = (culture: string, value: string) => {
    setDraftTranslations((current) => ({ ...current, [culture]: value }));
  };

  const discardChanges = () => {
    setDraftTranslations({ ...savedTranslations });
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
    const defaultLanguage =
      sortedLanguages.find((language) => language.isDefault) ?? sortedLanguages[0];
    const destinationLanguage = sortedLanguages.find(
      (language) => language.languageCode === destinationLanguageCode,
    );

    if (!defaultLanguage || !destinationLanguage) return;

    try {
      const response = await suggestTranslationAsync({
        sourceText: draftTranslations[defaultLanguage.languageCode] ?? "",
        destinationLanguage: destinationLanguage.languageName || "English",
        currentLanguage: defaultLanguage.languageName || "English",
        temperature: 0.1,
        glossaryIds: keyDetails.glossaryIds,
        moduleId: keyDetails.moduleId,
        destinationLanguageCode,
      });

      if (response.content) {
        setTranslation(destinationLanguageCode, response.content);
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
        description: JSON.stringify(response?.errors),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  return {
    autoTranslate,
    discardChanges,
    draftTranslations,
    hasChanges,
    hasEmptyChange,
    isAutoTranslating,
    isSaving,
    saveChanges,
    setTranslation,
    sortedLanguages,
  };
};
