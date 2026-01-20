import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronFirst, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ListPipelineJobsResponse } from "@/api/types.gen";
import { InfoBox } from "@/components/shared/InfoBox";
import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { type HomeSearchParams, indexRoute } from "@/routes/router";
import { getBackendStatusString } from "@/utils/backend";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

import { RunFiltersBar } from "./RunFiltersBar";
import RunRow from "./RunRow";
import { useRunFilters } from "./useRunFilters";

const PIPELINE_RUNS_QUERY_URL = "/api/pipeline_runs/";
const PAGE_TOKEN_QUERY_KEY = "page_token";
const FILTER_QUERY_KEY = "filter";
const CREATED_BY_ME_FILTER = "created_by:me";
const INCLUDE_PIPELINE_NAME_QUERY_KEY = "include_pipeline_names";
const INCLUDE_EXECUTION_STATS_QUERY_KEY = "include_execution_stats";

export const RunSection = ({ onEmptyList }: { onEmptyList?: () => void }) => {
  const { backendUrl, configured, available, ready } = useBackend();
  const navigate = useNavigate({ from: indexRoute.fullPath });
  const search = useSearch({ strict: false }) as Partial<HomeSearchParams>;
  const isCreatedByMeDefault = useBetaFlagValue("created-by-me-default");
  const isEnhancedFilteringEnabled = useBetaFlagValue("enhanced-run-filtering");
  const dataVersion = useRef(0);

  // Parse filter into a dictionary
  const parseFilter = (filter?: string): Record<string, string> => {
    if (!filter) return {};

    const filterDict: Record<string, string> = {};
    const parts = filter.split(",");

    for (const part of parts) {
      const [key, value] = part.split(":");
      if (key && value) {
        filterDict[key.trim()] = value.trim();
      }
    }

    return filterDict;
  };

  const filterDict = parseFilter(search.filter);
  const createdByValue = filterDict.created_by;

  const [searchUser, setSearchUser] = useState(createdByValue ?? "");

  // Determine if toggle should be on and what text to show
  const useCreatedByMe = createdByValue !== undefined;
  const toggleText = createdByValue
    ? `Created by ${createdByValue}`
    : "Created by me";

  const pageToken = search.page_token;
  const [previousPageTokens, setPreviousPageTokens] = useState<string[]>([]);

  const { data, isLoading, isFetching, error, isFetched } =
    useQuery<ListPipelineJobsResponse>({
      queryKey: ["runs", backendUrl, pageToken, search.filter],
      refetchOnWindowFocus: false,
      enabled: configured && available,
      queryFn: async () => {
        const u = new URL(PIPELINE_RUNS_QUERY_URL, backendUrl);
        if (pageToken) u.searchParams.set(PAGE_TOKEN_QUERY_KEY, pageToken);
        if (search.filter) u.searchParams.set(FILTER_QUERY_KEY, search.filter);

        u.searchParams.set(INCLUDE_PIPELINE_NAME_QUERY_KEY, "true");
        u.searchParams.set(INCLUDE_EXECUTION_STATS_QUERY_KEY, "true");

        if (!available) {
          throw new Error("Backend is not available");
        }

        dataVersion.current++;

        return fetchWithErrorHandling(u.toString());
      },
    });

  useEffect(() => {
    if (!search.page_token && search.filter === undefined) {
      handleFilterChange(isCreatedByMeDefault);
    }
  }, [isCreatedByMeDefault]);

  const handleFilterChange = (value: boolean) => {
    let newFilter: string | undefined;

    if (value) {
      // If there's already a created_by filter, keep it; otherwise use "created_by:me"
      if (!filterDict.created_by) {
        newFilter = CREATED_BY_ME_FILTER;
        setSearchUser("");
      } else {
        newFilter = search.filter;
      }
    } else {
      // Remove created_by from filter, but keep other filters
      const updatedFilterDict = { ...filterDict };
      delete updatedFilterDict.created_by;

      // Convert back to string format
      const remainingFilters = Object.entries(updatedFilterDict)
        .map(([key, value]) => `${key}:${value}`)
        .join(",");

      if (remainingFilters) {
        newFilter = remainingFilters;
      } else if (isCreatedByMeDefault) {
        newFilter = "";
      } else {
        newFilter = undefined;
      }
    }

    setPreviousPageTokens([]);
    navigate({
      search: (prev) => ({
        ...prev,
        page_token: undefined,
        filter: newFilter,
      }),
    });
  };

  const handleUserSearch = () => {
    if (!searchUser.trim()) return;

    // Create or update the created_by filter
    const updatedFilterDict = { ...filterDict };
    updatedFilterDict.created_by = searchUser.trim();

    // Convert back to string format
    const newFilter = Object.entries(updatedFilterDict)
      .map(([key, value]) => `${key}:${value}`)
      .join(",");

    setPreviousPageTokens([]);
    navigate({
      search: (prev) => ({
        ...prev,
        page_token: undefined,
        filter: newFilter,
      }),
    });
  };

  const handleNextPage = () => {
    if (data?.next_page_token) {
      setPreviousPageTokens([...previousPageTokens, pageToken || ""]);
      navigate({
        search: (prev) => ({
          ...prev,
          page_token: data.next_page_token,
        }),
      });
    }
  };

  const handlePreviousPage = () => {
    const previousToken = previousPageTokens[previousPageTokens.length - 1];
    setPreviousPageTokens(previousPageTokens.slice(0, -1));
    navigate({
      search: (prev) => ({
        ...prev,
        page_token: previousToken || undefined,
      }),
    });
  };

  const handleFirstPage = () => {
    setPreviousPageTokens([]);
    navigate({
      search: (prev) => ({
        ...prev,
        page_token: undefined,
      }),
    });
  };

  useEffect(() => {
    if (
      ready &&
      !isLoading &&
      isFetched &&
      !data?.pipeline_runs?.length &&
      dataVersion.current <= 1 &&
      searchUser.trim() === ""
    ) {
      onEmptyList?.();
    }
  }, [ready, data, isFetched, isLoading, onEmptyList, dataVersion, searchUser]);

  if (!available) {
    return (
      <InfoBox title="Backend not available" variant="warning">
        The configured backend is currently unavailable.
      </InfoBox>
    );
  }

  if (isLoading || isFetching || !ready) {
    return (
      <div className="flex gap-2 items-center">
        <Spinner /> Loading...
      </div>
    );
  }

  if (!configured) {
    return (
      <InfoBox title="Backend not configured" variant="warning">
        Configure a backend to create and view runs.
      </InfoBox>
    );
  }

  if (error) {
    const backendStatusString = getBackendStatusString(configured, available);
    return (
      <InfoBox title="Error loading runs" variant="error">
        <div className="mb-2">{error.message}</div>
        <div className="text-black italic">{backendStatusString}</div>
      </InfoBox>
    );
  }

  if (!data) {
    return (
      <InfoBox title="Failed to load runs" variant="error">
        No data was returned from the backend.
      </InfoBox>
    );
  }

  // Legacy search markup (used when enhanced filtering is disabled)
  const legacySearchMarkup = (
    <InlineStack
      gap="3"
      blockAlign="center"
      wrap="wrap"
      className="rounded-lg p-3 mb-4"
    >
      <InlineStack gap="2" blockAlign="center">
        <Switch
          id="created-by-me"
          checked={useCreatedByMe}
          onCheckedChange={handleFilterChange}
        />
        <Label htmlFor="created-by-me" className="text-sm">
          {toggleText}
        </Label>
      </InlineStack>
      <InlineStack gap="1" wrap="nowrap" blockAlign="center">
        <Input
          placeholder="Filter by user..."
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          className="w-36 h-9"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleUserSearch}
          disabled={!searchUser.trim()}
          className="h-9"
        >
          Apply
        </Button>
      </InlineStack>
    </InlineStack>
  );

  if (!data?.pipeline_runs || data?.pipeline_runs?.length === 0) {
    return (
      <BlockStack gap="4">
        {legacySearchMarkup}
        <div className="py-12 text-center">
          <Icon
            name="Search"
            className="w-8 h-8 mx-auto mb-3 text-muted-foreground"
          />
          <Text tone="subdued">
            {createdByValue
              ? `No runs found for user: ${createdByValue}`
              : "No runs found. Run a pipeline to see it here."}
          </Text>
        </div>
      </BlockStack>
    );
  }

  if (isEnhancedFilteringEnabled) {
    return (
      <EnhancedRunSection
        runs={data.pipeline_runs}
        nextPageToken={data.next_page_token ?? null}
        previousPageTokens={previousPageTokens}
        pageToken={pageToken}
        onFirstPage={handleFirstPage}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
        createdByValue={createdByValue}
        onCreatedByToggle={handleFilterChange}
        useCreatedByMe={useCreatedByMe}
        toggleText={toggleText}
        searchUser={searchUser}
        onSearchUserChange={setSearchUser}
        onUserSearch={handleUserSearch}
      />
    );
  }

  return (
    <BlockStack gap="4">
      {legacySearchMarkup}
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="w-1/3">Name</TableHead>
            <TableHead className="w-1/3">Status</TableHead>
            <TableHead className="w-1/6">Date</TableHead>
            <TableHead className="w-1/6">Initiated By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.pipeline_runs?.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </TableBody>
      </Table>

      {(data.next_page_token || previousPageTokens.length > 0) && (
        <InlineStack gap="2" align="space-between" blockAlign="center">
          <InlineStack gap="2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFirstPage}
              disabled={!pageToken}
            >
              <ChevronFirst className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={previousPageTokens.length === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
          </InlineStack>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!data.next_page_token}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </InlineStack>
      )}
    </BlockStack>
  );
};

interface EnhancedRunSectionProps {
  runs: NonNullable<ListPipelineJobsResponse["pipeline_runs"]>;
  nextPageToken: string | null;
  previousPageTokens: string[];
  pageToken: string | undefined;
  onFirstPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  createdByValue: string | undefined;
  onCreatedByToggle: (value: boolean) => void;
  useCreatedByMe: boolean;
  toggleText: string;
  searchUser: string;
  onSearchUserChange: (value: string) => void;
  onUserSearch: () => void;
}

function EnhancedRunSection({
  runs,
  nextPageToken,
  previousPageTokens,
  pageToken,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  createdByValue,
  onCreatedByToggle,
  useCreatedByMe,
  toggleText,
  searchUser,
  onSearchUserChange,
  onUserSearch,
}: EnhancedRunSectionProps) {
  const {
    filters,
    filteredAndSortedRuns,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    updateFilter,
  } = useRunFilters(runs);

  return (
    <BlockStack gap="4">
      {/* Server-side filter bar (API filters) */}
      <InlineStack
        gap="3"
        blockAlign="center"
        wrap="wrap"
        className="rounded-lg p-3"
      >
        <InlineStack gap="2" blockAlign="center">
          <Switch
            id="created-by-me-enhanced"
            checked={useCreatedByMe}
            onCheckedChange={onCreatedByToggle}
          />
          <Label htmlFor="created-by-me-enhanced" className="text-sm">
            {toggleText}
          </Label>
        </InlineStack>

        <InlineStack gap="1" wrap="nowrap" blockAlign="center">
          <Input
            placeholder="Filter by user..."
            value={searchUser}
            onChange={(e) => onSearchUserChange(e.target.value)}
            className="w-36 h-9"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={onUserSearch}
            disabled={!searchUser.trim()}
            className="h-9"
          >
            Apply
          </Button>
        </InlineStack>
      </InlineStack>

      {/* Client-side filter bar (local filtering) */}
      <RunFiltersBar
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onUpdateFilter={updateFilter}
        onClearFilters={clearFilters}
        totalCount={runs.length}
        filteredCount={filteredAndSortedRuns.length}
      />

      {filteredAndSortedRuns.length === 0 ? (
        <div className="py-12 text-center">
          <Icon name="Search" className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <Text tone="subdued">
            {createdByValue
              ? `No runs match the current filters for user: ${createdByValue}`
              : "No runs match the current filters."}
          </Text>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-1/3">Name</TableHead>
              <TableHead className="w-1/3">Status</TableHead>
              <TableHead className="w-1/6">Date</TableHead>
              <TableHead className="w-1/6">Initiated By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedRuns.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </TableBody>
        </Table>
      )}

      {(nextPageToken || previousPageTokens.length > 0) && (
        <InlineStack gap="2" align="space-between" blockAlign="center">
          <InlineStack gap="2">
            <Button
              variant="outline"
              size="sm"
              onClick={onFirstPage}
              disabled={!pageToken}
            >
              <ChevronFirst className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
              disabled={previousPageTokens.length === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
          </InlineStack>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={!nextPageToken}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </InlineStack>
      )}
    </BlockStack>
  );
}
