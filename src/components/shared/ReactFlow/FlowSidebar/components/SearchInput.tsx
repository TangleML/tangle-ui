import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { type SearchInputProps } from "@/types/componentLibrary";
import { COMPONENT_SEARCH_FILTERS } from "@/utils/constants";

import SearchFilter from "./SearchFilter";

const SearchInput = ({
  value,
  activeFilters,
  onChange,
  onFiltersChange,
}: SearchInputProps) => {
  return (
    <div className="px-2 pb-2 pt-1 flex items-center justify-between gap-2">
      <div className="relative w-full" data-tour="library-search">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 z-10 pointer-events-none">
          <Search className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <Input
          type="text"
          data-testid="search-input"
          placeholder="Search components..."
          className="w-full pl-8 text-sm h-8 focus-visible:ring-gray-400/50"
          value={value}
          onChange={onChange}
        />
      </div>
      <SearchFilter
        availableFilters={COMPONENT_SEARCH_FILTERS}
        activeFilters={activeFilters}
        disableCounter={value.trim() === ""}
        onFiltersChange={onFiltersChange}
      />
    </div>
  );
};

export default SearchInput;
