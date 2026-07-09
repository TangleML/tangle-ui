import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useForcedSearchContext } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import type { SearchResult } from "@/types/componentLibrary";
import { ComponentSearchFilter } from "@/utils/constants";

import { ComponentMarkup } from "./ComponentItem";

interface SearchResultsProps {
  searchResult: SearchResult;
  onFiltersChange: (filters: string[]) => void;
}

const SearchResults = ({
  searchResult,
  onFiltersChange,
}: SearchResultsProps) => {
  const { currentSearchFilter } = useForcedSearchContext();

  const matchedComponents = searchResult.components.standard;

  const matchedUserComponents = searchResult.components.user;

  const handleNameFilterClick = useCallback(() => {
    if (!currentSearchFilter.filters.includes(ComponentSearchFilter.NAME)) {
      onFiltersChange([
        ...currentSearchFilter.filters,
        ComponentSearchFilter.NAME,
      ]);
    }
  }, [currentSearchFilter.filters, onFiltersChange]);

  const filtersWithoutExactMatch =
    currentSearchFilter.filters?.filter(
      (f) => f !== ComponentSearchFilter.EXACTMATCH,
    ) ?? [];

  const exactMatchFilter = currentSearchFilter.filters?.includes(
    ComponentSearchFilter.EXACTMATCH,
  );

  if (filtersWithoutExactMatch.length === 0) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 flex flex-col items-center">
        No search filters set.{" "}
        <Button
          variant="ghost"
          onClick={handleNameFilterClick}
          className="text-sky-500 hover:text-sky-600 focus:text-sky-600 active:text-sky-700"
        >
          Filter by name
        </Button>
      </div>
    );
  }

  const hasResults =
    matchedComponents.length > 0 || matchedUserComponents.length > 0;
  if (!hasResults) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500">
        No component {filtersWithoutExactMatch.join(" or ")}{" "}
        {exactMatchFilter ? "exactly matches" : "contains"} &ldquo;
        {currentSearchFilter.searchTerm}
        &rdquo;
      </div>
    );
  }

  const totalResults = matchedComponents.length + matchedUserComponents.length;

  return (
    <div className="py-2">
      <div
        className="px-4 pb-2 text-sm font-medium text-gray-600 dark:text-muted-foreground border-b"
        data-testid="search-results-header"
      >
        Search Results ({totalResults})
      </div>
      <div className="mt-1">
        {matchedUserComponents.length > 0 && (
          <>
            {/* User component section header if both types exist */}
            {matchedComponents.length > 0 && (
              <div className="px-4 py-1 text-xs font-medium text-gray-500">
                User Components
              </div>
            )}
            {/* User component results */}
            {matchedUserComponents.map((component, index) => (
              <ComponentMarkup key={`user-${index}`} component={component} />
            ))}
          </>
        )}

        {matchedComponents.length > 0 && (
          <>
            {/* Library component section header if both types exist */}
            {matchedUserComponents.length > 0 && (
              <div className="px-4 py-1 mt-2 text-xs font-medium text-gray-500">
                Library Components
              </div>
            )}
            {/* Library component results */}
            {matchedComponents.map((component, index) => (
              <ComponentMarkup key={`lib-${index}`} component={component} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
