import { useSuspenseQuery } from "@tanstack/react-query";
import {
  type ChangeEvent,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radiogroup";
import { Separator } from "@/components/ui/separator";
import { SidebarMenu } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider/ComponentLibraryProvider";
import {
  isValidFilterRequest,
  type LibraryFilterRequest,
} from "@/providers/ComponentLibraryProvider/types";
import type { ComponentFolder } from "@/types/componentLibrary";
import { ComponentSearchFilter } from "@/utils/constants";

import { ComponentMarkup } from "./ComponentItem";

/**
 * This file contains all the components for the published components search.
 * TODO: split out the components into smaller files (one file per component)
 */

interface SearchResultsProps {
  searchResult?: ComponentFolder[];
}

interface SearchRequestProps {
  value: string;
  onChange: (searchRequest: LibraryFilterRequest) => void;
}

type ApiSearchFilter = "name" | "author";

interface FilterDescription {
  label: string;
  value: ApiSearchFilter;
}

interface SearchFilterProps {
  availableFilters?: FilterDescription[];
  onFiltersChange: (filters: string[]) => void;
}

const DEFAULT_AVAILABLE_FILTERS: FilterDescription[] = [
  {
    label: "Name",
    value: "name",
  },
  {
    label: "Published By",
    value: "author",
  },
];

const DEFAULT_ACTIVE_FILTERS = ["name"];

const SearchFilter = ({
  availableFilters = DEFAULT_AVAILABLE_FILTERS,
  onFiltersChange,
}: SearchFilterProps) => {
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ApiSearchFilter>("name");

  const handleFilterChange = useCallback(
    (filter: ApiSearchFilter) => {
      setActiveFilter(filter);
      onFiltersChange([filter]);
      // it is more convenient to close the popover after the filter is changed, saves at least one click
      setTimeout(() => {
        setOpen(false);
      }, 200);
    },
    [onFiltersChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <InlineStack align="center" gap="1" className="relative">
          <Button variant="outline" size="icon" className="h-8 w-8 p-0">
            <Icon name="ListFilter" />
          </Button>
        </InlineStack>
      </PopoverTrigger>
      <PopoverContent className="w-40">
        <BlockStack gap="2">
          <Text size="md">Filter Search</Text>
          <BlockStack gap="1">
            <RadioGroup onValueChange={handleFilterChange} value={activeFilter}>
              {availableFilters.map(({ label, value }) => {
                return (
                  <InlineStack key={value} gap="2" align="start">
                    <RadioGroupItem
                      id={value}
                      value={value}
                      className="hover:cursor-pointer"
                    />
                    <Label
                      htmlFor={value}
                      className="font-light text-sm hover:cursor-pointer"
                    >
                      {label}
                    </Label>
                  </InlineStack>
                );
              })}
            </RadioGroup>
          </BlockStack>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
};

const debounce = <F extends (...args: Parameters<F>) => ReturnType<F>>(
  func: F,
  waitFor: number,
) => {
  let timeout: ReturnType<typeof setTimeout>;

  const debounced = (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
};

const SearchRequestInput = ({ value, onChange }: SearchRequestProps) => {
  const DEBOUNCE_TIME_MS = 200;

  type SearchRequestAction =
    | { type: "SET_SEARCH_TERM"; payload: string }
    | { type: "SET_FILTERS"; payload: string[] };

  const searchRequestReducer = useCallback(
    (state: LibraryFilterRequest, action: SearchRequestAction) => {
      switch (action.type) {
        case "SET_SEARCH_TERM":
          return { ...state, searchTerm: action.payload };
        case "SET_FILTERS":
          return { ...state, filters: action.payload };
        default:
          return state;
      }
    },
    [],
  );

  const debouncedOnChange = useMemo(
    () =>
      debounce((searchRequest: LibraryFilterRequest) => {
        onChange(searchRequest);
      }, DEBOUNCE_TIME_MS),
    [onChange],
  );

  const [searchRequest, dispatch] = useReducer(searchRequestReducer, {
    searchTerm: value,
    filters: DEFAULT_ACTIVE_FILTERS,
  });

  useEffect(() => {
    debouncedOnChange(searchRequest);
  }, [searchRequest, debouncedOnChange]);

  const onFiltersChange = useCallback((filters: string[]) => {
    dispatch({ type: "SET_FILTERS", payload: filters });
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_SEARCH_TERM", payload: e.target.value });
  }, []);

  return (
    <InlineStack align="space-between" gap="2" className="w-full">
      <div className="relative flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroup
              className="px-2 gap-2"
              prefixElement={
                <div className="inset-y-0 left-0 flex items-center pointer-events-none">
                  <Icon name="Search" size="sm" className="text-gray-400" />
                </div>
              }
              suffixElement={
                <Button
                  variant="ghost"
                  size="min"
                  className={cn(
                    isValidFilterRequest(searchRequest) ? "visible" : "hidden",
                  )}
                  onClick={() => {
                    dispatch({ type: "SET_SEARCH_TERM", payload: "" });
                  }}
                >
                  <Icon name="X" className="size-3 text-muted-foreground" />
                </Button>
              }
            >
              <Input
                id="search-input"
                variant="noBorder"
                type="text"
                data-testid="search-input"
                placeholder="Search components..."
                className="w-full text-xs p-0"
                value={searchRequest.searchTerm}
                autoComplete="off"
                onChange={handleChange}
              />
            </InputGroup>
          </TooltipTrigger>
          <TooltipContent>Search components - min 3 characters</TooltipContent>
        </Tooltip>
      </div>
      <SearchFilter onFiltersChange={onFiltersChange} />
    </InlineStack>
  );
};

const SearchResults = ({ searchResult }: SearchResultsProps) => {
  if (!searchResult) {
    return null;
  }

  const totalResults = searchResult.reduce(
    (acc, curr) => acc + (curr.components?.length ?? 0),
    0,
  );

  return (
    <BlockStack gap="2" className="px-2" data-testid="search-results-container">
      <Text
        tone="subdued"
        data-testid="search-results-header"
      >{`Search Results (${totalResults})`}</Text>
      <Separator />
      <div className="h-[calc(100vh-400px)] w-full overflow-y-auto overflow-x-hidden scrollbar-thin">
        <SidebarMenu>
          {totalResults > 0 ? (
            searchResult.map((folder) => (
              <BlockStack key={folder.name}>
                {folder.components && folder.components.length > 0 ? (
                  <>
                    {searchResult.length > 1 ? (
                      <Text tone="subdued" size="xs">
                        {folder.name}
                      </Text>
                    ) : null}
                    {folder.components.map((component) => (
                      <ComponentMarkup
                        key={`${folder.name}-${component.digest}-${component.name}`}
                        component={component}
                      />
                    ))}
                  </>
                ) : null}
              </BlockStack>
            ))
          ) : (
            <Text tone="subdued">No results found</Text>
          )}
        </SidebarMenu>
      </div>
    </BlockStack>
  );
};

const SearchResultsSkeleton = () => {
  return (
    <BlockStack gap="2" className="px-2">
      <InlineStack align="start" gap="1">
        <Text tone="subdued">Search Results </Text>
        <Spinner />
      </InlineStack>

      <BlockStack>
        <BlockStack gap="2">
          <Skeleton size="lg" className="h-4 w-full" />
          <Skeleton size="sm" className="h-4 w-full" />
          <Skeleton size="lg" className="h-4 w-full" />
        </BlockStack>
      </BlockStack>
    </BlockStack>
  );
};

const Search = withSuspenseWrapper(
  ({ searchRequest }: { searchRequest: LibraryFilterRequest }) => {
    const { backendUrl } = useBackend();
    const { getComponentLibrary, searchComponentLibrary } =
      useComponentLibrary();
    const publishedComponentsLibrary = getComponentLibrary(
      "published_components",
    );

    const { data } = useSuspenseQuery({
      queryKey: ["componentLibrary", "publishedComponents", searchRequest],
      staleTime: 1000 * 60 * 5, // 5 minutes
      queryFn: async () => {
        const remoteSearchResult =
          await publishedComponentsLibrary.getComponents(searchRequest);

        const staticSearchResult = isValidFilterRequest(searchRequest, {
          includesFilter: "name",
        })
          ? await searchComponentLibrary(searchRequest.searchTerm, [
              ComponentSearchFilter.NAME,
            ])
          : null;

        const { used: usedComponentResult, user: userComponentResult } =
          staticSearchResult?.components ?? {};

        const result: ComponentFolder[] = [];

        if (
          remoteSearchResult.components &&
          remoteSearchResult.components.length > 0
        ) {
          result.push({
            name: "Library Components",
            // normalize the components to the ComponentReference type
            components: remoteSearchResult.components.map((component) => ({
              digest: component.digest,
              name: component.name,
              // todo: revisit?
              url:
                component.url ??
                `${backendUrl}/api/components/${component.digest}`,
              published_by: component.published_by,
            })),
          });
        }

        if (usedComponentResult && usedComponentResult.length > 0) {
          result.push({
            name: "Used in Pipeline",
            components: usedComponentResult,
          });
        }

        if (userComponentResult && userComponentResult.length > 0) {
          result.push({
            name: "User Components",
            components: userComponentResult,
          });
        }

        return result;
      },
    });

    if (data) {
      return (
        <BlockStack>
          <SearchResults searchResult={data} />
        </BlockStack>
      );
    }

    return <BlockStack>No results found</BlockStack>;
  },
  SearchResultsSkeleton,
);

const MIN_SEARCH_TERM_LENGTH = 3;

function isSearchRequestValid(searchRequest: LibraryFilterRequest | undefined) {
  return isValidFilterRequest(searchRequest, {
    minLength: MIN_SEARCH_TERM_LENGTH,
  });
}

const PublishedComponentsSearch = ({ children }: PropsWithChildren) => {
  const [searchRequest, setSearchRequest] = useState<
    LibraryFilterRequest | undefined
  >();

  const handleSearchRequestChange = useCallback(
    (searchRequest: LibraryFilterRequest) => {
      setSearchRequest(searchRequest);
    },
    [setSearchRequest],
  );

  return (
    <BlockStack gap="2">
      <BlockStack className="px-2 py-1">
        <SearchRequestInput value={""} onChange={handleSearchRequestChange} />
      </BlockStack>
      {isSearchRequestValid(searchRequest) ? (
        <Search searchRequest={searchRequest} />
      ) : (
        children
      )}
    </BlockStack>
  );
};

export default PublishedComponentsSearch;
