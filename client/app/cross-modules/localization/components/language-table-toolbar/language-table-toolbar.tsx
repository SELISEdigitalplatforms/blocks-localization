import React from "react";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Label } from "@/components/ui-kits/label/label";
import {
  FilterChangeHandler,
  FilterToolbar,
  useSortQueryParams,
} from "@/components/filter-toolbar";
import {
  createParser,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from "nuqs";
import {
  DEFAULT_KEY_PAGE_SIZE,
  parseKeyPageSize,
  type KeyPageSize,
} from "@blocks-localization/language-module/language-table/language-table.utils";

const parseAsKeyPageSize = createParser<KeyPageSize>({
  parse: parseKeyPageSize,
  serialize: String,
});

export const useKeysFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    pageNumber: parseAsInteger.withDefault(0),
    pageSize: parseAsKeyPageSize.withDefault(DEFAULT_KEY_PAGE_SIZE),
    search: parseAsString.withDefault(""),
    moduleIds: parseAsArrayOf(parseAsString).withDefault([]),
    missingLanguages: parseAsArrayOf(parseAsString).withDefault([]),
    createStartDate: parseAsString.withDefault(""),
    createEndDate: parseAsString.withDefault(""),
    lastUpdateStartDate: parseAsString.withDefault(""),
    lastUpdateEndDate: parseAsString.withDefault(""),
    resourceSearch: parseAsString.withDefault(""),
    // Set by the duplicates chip in the Translations header: show only duplicate key rows.
    duplicates: parseAsBoolean.withDefault(false),
    // "Glossary issues": only keys with violations the server stored.
    glossaryIssues: parseAsBoolean.withDefault(false),
  });
  return { queryParams, setQueryParams };
};
export const useKeysSortQueryParams = () =>
  useSortQueryParams({ initial: { property: "KeyName", isDescending: false } });

export function LanguageTableToolbar({
  languageModulesData,
  languagesData,
  disabled = false,
}: {
  languageModulesData: Array<{ itemId: string; moduleName: string }>;
  languagesData: Array<{ languageCode: string; languageName: string }>;
  disabled?: boolean;
}) {
  const { queryParams, setQueryParams } = useKeysFilterQueryParams();
  const onChange: FilterChangeHandler<{
    search: string;
    moduleIds: string[];
    missingLanguages: string[];
    createDate: { from?: Date; to?: Date } | null;
    lastUpdateDate: { from?: Date; to?: Date } | null;
    glossaryIssues: boolean;
  }> = (key, value) => {
    if (key === "createDate") {
      const dateValue = value as { from?: Date; to?: Date } | null;
      const from = dateValue?.from;
      const to = dateValue?.to;

      setQueryParams((prev) => ({
        ...prev,
        createStartDate: from?.toISOString() || "",
        createEndDate: to?.toISOString() || "",
        pageNumber: 0,
      }));
      return;
    }
    if (key === "lastUpdateDate") {
      const dateValue = value as { from?: Date; to?: Date } | null;
      const from = dateValue?.from;
      const to = dateValue?.to;

      setQueryParams((prev) => ({
        ...prev,
        lastUpdateStartDate: from?.toISOString() || "",
        lastUpdateEndDate: to?.toISOString() || "",
        pageNumber: 0,
      }));
      return;
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
  const onGlossaryIssuesChange = (checked: boolean) => {
    setQueryParams((prev) => ({
      ...prev,
      glossaryIssues: checked,
      pageNumber: 0,
    }));
  };
  return (
    <fieldset
      disabled={disabled}
      className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0 md:flex-row md:flex-wrap md:items-center md:gap-4"
    >
      <div className="min-w-0 md:contents">
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
              to: queryParams.lastUpdateEndDate
                ? new Date(queryParams.lastUpdateEndDate)
                : undefined,
            },
            resourceSearch: queryParams.resourceSearch,
            glossaryIssues: queryParams.glossaryIssues,
          }}
          defaultValues={{
            search: "",
            moduleIds: [],
            missingLanguages: [],
            createDate: { from: undefined, to: undefined },
            lastUpdateDate: { from: undefined, to: undefined },
            resourceSearch: "",
            glossaryIssues: false,
          }}
          onChange={onChange}
          onReset={onReset}
          disabled={disabled}
        />
      </div>
      <div className="flex h-8 items-center gap-2">
        <Checkbox
          id="language-table-glossary-issues"
          checked={queryParams.glossaryIssues}
          onCheckedChange={(checked) => onGlossaryIssuesChange(checked === true)}
          disabled={disabled}
        />
        <Label htmlFor="language-table-glossary-issues" className="cursor-pointer">
          Glossary issues
        </Label>
      </div>
    </fieldset>
  );
}
