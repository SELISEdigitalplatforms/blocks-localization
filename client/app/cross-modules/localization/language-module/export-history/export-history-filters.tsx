
import React from "react";
import { FilterToolbar, type FilterChangeHandler } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

type ExportHistoryFiltersProps = {
  onChange: (filters: { search: string; startDate: string; endDate: string }) => void;
};

export const ExportHistoryFilters: React.FC<ExportHistoryFiltersProps> = ({ onChange }) => {
  // Query param state handled right inside this component
  const [queryParams, setQueryParams] = useQueryStates({
    pageNumber: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    search: parseAsString.withDefault(""),
    startDate: parseAsString.withDefault(""),
    endDate: parseAsString.withDefault(""),
  });

  const handleChange: FilterChangeHandler<{
    search: string;
    created: { from?: Date; to?: Date } | null;
  }> = (key, value) => {
    if (key === "created") {
      const { from, to } = (value || {}) as { from?: Date; to?: Date };
      
      // Convert dates to ISO strings without timezone shift
      const formatDateToISO = (date?: Date) => {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}T00:00:00.000Z`;
      };

      const startDateFormatted = from ? formatDateToISO(from) : "";
      let endDateFormatted = "";

      // Only use endDate if it's explicitly different from startDate
      if (to && from) {
        const fromStr = from.toDateString();
        const toStr = to.toDateString();
        
        // Only set end date if it's a different day than start date
        if (fromStr !== toStr) {
          endDateFormatted = formatDateToISO(to);
        }
      }

      const newParams = {
        ...queryParams,
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        pageNumber: 0,
      };
      setQueryParams(newParams);
      onChange(newParams);
      return;
    }
    if (key === "search") {
      const newParams = {
        ...queryParams,
        search: (value as string) ?? "",
        pageNumber: 0,
      };
      setQueryParams(newParams);
      onChange(newParams);
    }
  };

  const handleReset = () => {
    setQueryParams(null);
    onChange({ search: "", startDate: "", endDate: "" });
  };

  return (
    <div className="mb-4">
      <FilterToolbar
        filters={[
          { key: "search", type: "SearchInput", label: "Search" },
          { key: "created", type: "DateRange", label: "Date", props: {} },
        ]}
        values={{
          search: queryParams.search,
          created: {
            from: queryParams.startDate
              ? new Date(queryParams.startDate.split("T")[0])
              : undefined,
            to: queryParams.endDate ? new Date(queryParams.endDate.split("T")[0]) : undefined,
          },
        }}
        defaultValues={{
          search: "",
          created: { from: undefined, to: undefined },
        }}
        onChange={handleChange}
        onReset={handleReset}
      />
    </div>
  );
};
