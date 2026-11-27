import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { CopyText } from "@/components/shared/CopyText/CopyText";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { ResizableTableHeader } from "@/components/shared/ResizableTableHeader";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import { useBackend } from "@/providers/BackendProvider";
import { getDefaultRemoteEditorPath } from "@/routes/editorRoutes";
import { PipelineSpecApiError } from "@/services/pipelineSpecService";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";
import type { RemotePipelinesPage } from "@/services/remotePipelinesService";
import { formatDate } from "@/utils/date";
import { hasNewTabModifier } from "@/utils/dom";

import {
  getRemotePipelinesFilterQuery,
  isInvalidPipelineId,
  type RemotePipelineSearchFilters,
} from "./pipelinesSearch";
import { RemotePipelineActions } from "./RemotePipelineActions";
import { RemotePipelinesFilters } from "./RemotePipelinesFilters";

const COLUMNS = [
  { name: "Name", width: 25 },
  { name: "ID", width: 15 },
  { name: "User", width: 20 },
  { name: "Created at", width: 12 },
  { name: "Updated at", width: 12 },
  { name: "Current version", width: 16 },
];

interface RemotePipelinesTableProps {
  filters: RemotePipelineSearchFilters;
  onFiltersChange: (filters: RemotePipelineSearchFilters) => void;
}

interface RemotePipelinesPagination {
  backendUrl: string;
  filterQuery?: string;
  tokens: string[];
}

export function RemotePipelinesTable({
  filters,
  onFiltersChange,
}: RemotePipelinesTableProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { backendUrl, configured, available, ready } = useBackend();
  const deletingIds = useMutationState({
    filters: {
      mutationKey: RemotePipelineQueryKeys.Deletions(backendUrl),
      status: "pending",
    },
    select: (mutation) => mutation.options.mutationKey?.[2],
  });
  const filterQuery = getRemotePipelinesFilterQuery(filters);
  const invalidId = isInvalidPipelineId(filters.id);
  const [isEditingFilters, setIsEditingFilters] = useState(false);
  const [pagination, setPagination] = useState<RemotePipelinesPagination>({
    backendUrl,
    filterQuery,
    tokens: [],
  });
  const hasCurrentPagination =
    pagination.backendUrl === backendUrl &&
    pagination.filterQuery === filterQuery;
  const pageTokens = hasCurrentPagination ? pagination.tokens : [];
  if (!hasCurrentPagination) {
    setPagination({ backendUrl, filterQuery, tokens: [] });
  }
  const currentPage = pageTokens.length + 1;
  const pageToken = pageTokens.at(-1);
  const tableRef = useRef<HTMLTableElement>(null);
  const canFetch =
    ready && configured && available && !isEditingFilters && !invalidId;
  const {
    data,
    isLoading,
    isFetching: isQueryFetching,
    error,
  } = useRemotePipelinesPage(backendUrl, pageToken, canFetch, filterQuery);
  const isFetching = isQueryFetching || isEditingFilters;
  const pipelines = data?.pipelines ?? [];

  function changePage(tokens: string[]) {
    setPagination({ backendUrl, filterQuery, tokens });
  }

  function recoverAfterDeletion(restoreFocus: boolean) {
    if (restoreFocus) tableRef.current?.focus();
    if (currentPage === 1) return;
    const refreshed = queryClient.getQueryState<RemotePipelinesPage>(
      RemotePipelineQueryKeys.Cursor(backendUrl, filterQuery, pageToken),
    );
    if (
      refreshed?.status !== "success" ||
      refreshed.data?.pipelines.length !== 0
    )
      return;
    setPagination((current) =>
      current.backendUrl === backendUrl &&
      current.filterQuery === filterQuery &&
      current.tokens.at(-1) === pageToken
        ? { ...current, tokens: current.tokens.slice(0, -1) }
        : current,
    );
  }

  let message: string | undefined;
  if (!ready) message = "Loading pipelines…";
  else if (!configured) message = "Configure a backend to view pipelines.";
  else if (!available) message = "Pipelines are unavailable.";
  else if (invalidId) message = "Enter a complete pipeline ID to search.";
  else if (isLoading) message = "Loading pipelines…";
  else if (error)
    message =
      error instanceof PipelineSpecApiError
        ? error.message
        : "Failed to load pipelines.";
  else if (pipelines.length === 0) message = "No pipelines found.";

  return (
    <BlockStack gap="4" className="w-full">
      <RemotePipelinesFilters
        key={backendUrl}
        filters={filters}
        onChange={onFiltersChange}
        onPendingChange={setIsEditingFilters}
      />
      <Table
        ref={tableRef}
        tabIndex={-1}
        aria-label="Remote Pipelines"
        aria-busy={isFetching}
        className="table-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ResizableTableHeader columns={COLUMNS} />
        <TableBody>
          {message ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length + 1}
                className="whitespace-normal text-center"
              >
                <Text size="sm" tone="subdued">
                  {message}
                </Text>
              </TableCell>
            </TableRow>
          ) : (
            pipelines.map((pipeline) => (
              <TableRow
                key={pipeline.id}
                className="cursor-pointer text-xs"
                onClick={(event) => {
                  if (deletingIds.includes(pipeline.id)) return;
                  const destination = {
                    to: getDefaultRemoteEditorPath(pipeline.id),
                  };
                  if (hasNewTabModifier(event)) {
                    window.open(
                      router.history.createHref(
                        router.buildLocation(destination).href,
                      ),
                      "_blank",
                      "noopener,noreferrer",
                    );
                  } else {
                    void navigate(destination);
                  }
                }}
              >
                <TableCell className="text-sm">
                  <InlineStack
                    blockAlign="center"
                    wrap="nowrap"
                    className="min-h-9"
                  >
                    <Link
                      to={getDefaultRemoteEditorPath(pipeline.id)}
                      disabled={deletingIds.includes(pipeline.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="block truncate hover:underline"
                      title={pipeline.pipeline_name ?? "Untitled Pipeline"}
                    >
                      {pipeline.pipeline_name ?? "Untitled Pipeline"}
                    </Link>
                  </InlineStack>
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <InlineStack
                    blockAlign="center"
                    wrap="nowrap"
                    className="min-h-9"
                  >
                    <CopyText
                      size="xs"
                      className="truncate"
                      copyLabel="Copy pipeline ID"
                    >
                      {pipeline.id}
                    </CopyText>
                  </InlineStack>
                </TableCell>
                <TruncatedTableCell>{pipeline.user_id}</TruncatedTableCell>
                <TruncatedTableCell title={pipeline.created_at}>
                  {formatDate(pipeline.created_at)}
                </TruncatedTableCell>
                <TruncatedTableCell title={pipeline.updated_at}>
                  {formatDate(pipeline.updated_at)}
                </TruncatedTableCell>
                <TruncatedTableCell>
                  {pipeline.current_version}
                </TruncatedTableCell>
                <TableCell
                  className="w-20"
                  onClick={(event) => event.stopPropagation()}
                >
                  <RemotePipelineActions
                    key={backendUrl}
                    backendUrl={backendUrl}
                    pipeline={pipeline}
                    onDeleted={recoverAfterDeletion}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {(currentPage > 1 || data?.nextPageToken) && (
        <nav aria-label="Remote pipelines pagination" className="w-full">
          <PaginationControls
            currentPage={currentPage}
            hasPreviousPage={currentPage > 1}
            hasNextPage={Boolean(data?.nextPageToken)}
            disabled={!canFetch || isFetching}
            onPreviousPage={() => changePage(pageTokens.slice(0, -1))}
            onNextPage={() => {
              if (data?.nextPageToken) {
                changePage([...pageTokens, data.nextPageToken]);
              }
            }}
            onReset={() => changePage([])}
          />
        </nav>
      )}
    </BlockStack>
  );
}

function TruncatedTableCell({
  children,
  title = children,
  className,
}: {
  children: string;
  title?: string;
  className?: string;
}) {
  return (
    <TableCell className={className}>
      <InlineStack blockAlign="center" wrap="nowrap" className="min-h-9">
        <span className="block truncate" title={title}>
          {children}
        </span>
      </InlineStack>
    </TableCell>
  );
}
