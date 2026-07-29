import React from "react";
import {
  FilterChangeHandler,
  FilterToolbar,
  useSortQueryParams,
} from "@/components/filter-toolbar";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

export const useKeysFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    pageNumber: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    search: parseAsString.withDefault(""),
    moduleIds: parseAsArrayOf(parseAsString).withDefault([]),
    missingLanguages: parseAsArrayOf(parseAsString).withDefault([]),
    createStartDate: parseAsString.withDefault(""),
    createEndDate: parseAsString.withDefault(""),
    lastUpdateStartDate: parseAsString.withDefault(""),
    lastUpdateEndDate: parseAsString.withDefault(""),
    resourceSearch: parseAsString.withDefault(""),
  });
  return { queryParams, setQueryParams };
};
export const useKeysSortQueryParams = () =>
  useSortQueryParams({ initial: { property: "KeyName", isDescending: false } });

export function LanguageTableToolbar({
  languageModulesData,
  languagesData,
}: {
  languageModulesData: Array<{ itemId: string; moduleName: string }>;
  languagesData: Array<{ languageCode: string; languageName: string }>;
}) {
  const { queryParams, setQueryParams } = useKeysFilterQueryParams();
  const onChange: FilterChangeHandler<{
    search: string;
    moduleIds: string[];
    missingLanguages: string[];
    createDate: { from?: Date; to?: Date } | null;
    lastUpdateDate: { from?: Date; to?: Date } | null;
  }> = (key, value) => {
    if (key === "createDate") {
      const dateValue = value as { from?: Date; to?: Date } | null;
      const from = dateValue?.from;
      const to = dateValue?.to;

      return setQueryParams((prev) => ({
        ...prev,
        createStartDate: from?.toISOString() || "",
        createEndDate: to?.toISOString() || "",
        pageNumber: 0,
      }));
    }
    if (key === "lastUpdateDate") {
      const dateValue = value as { from?: Date; to?: Date } | null;
      const from = dateValue?.from;
      const to = dateValue?.to;

      return setQueryParams((prev) => ({
        ...prev,
        lastUpdateStartDate: from?.toISOString() || "",
        lastUpdateEndDate: to?.toISOString() || "",
        pageNumber: 0,
      }));
    }
    setQueryParams((prev) => ({
      ...prev,
      [key]: value,
      pageNumber: 0,
    }));
  };
  const onReset = () => {
    setQueryParams(null);
  };
  return (
    <FilterToolbar
      filters={[
        // { key: "search", type: "SearchInput", label: "label" },
        {
          key: "moduleIds",
          type: "MultiSelect",
          label: "Modules",
          props: {
            options: languageModulesData?.map((module) => ({
              label: module.moduleName,
              value: module.itemId,
            })),
          },
        },
        {
          key: "missingLanguages",
          type: "MultiSelect",
          label: "Missing Translations",
          props: {
            options: languagesData?.map((lang) => ({
              label: lang.languageName,
              value: lang.languageCode,
            })),
          },
        },
        {
          key: "createDate",
          type: "DateRange",
          label: "Create Date",
          props: {
            disableFutureDates: true,
          },
        },
        {
          key: "lastUpdateDate",
          type: "DateRange",
          label: "Last Update Date",
          props: {
            disableFutureDates: true,
          },
        },
      ]}
      values={{
        search: queryParams.search,
        moduleIds: queryParams.moduleIds,
        missingLanguages: queryParams.missingLanguages,
        createDate: {
          from: queryParams.createStartDate ? new Date(queryParams.createStartDate) : undefined,
          to: queryParams.createEndDate ? new Date(queryParams.createEndDate) : undefined,
        },
        lastUpdateDate: {
          from: queryParams.lastUpdateStartDate
            ? new Date(queryParams.lastUpdateStartDate)
            : undefined,
          to: queryParams.lastUpdateEndDate ? new Date(queryParams.lastUpdateEndDate) : undefined,
        },
        resourceSearch: queryParams.resourceSearch,
      }}
      defaultValues={{
        search: "",
        moduleIds: [],
        missingLanguages: [],
        createDate: { from: undefined, to: undefined },
        lastUpdateDate: { from: undefined, to: undefined },
        resourceSearch: "",
      }}
      onChange={onChange}
      onReset={onReset}
    />
  );
}
