import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { type PointerEvent, useRef, useState } from "react";

import { CopyText } from "@/components/shared/CopyText/CopyText";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import { useBackend } from "@/providers/BackendProvider";
import { getDefaultRemoteEditorPath } from "@/routes/editorRoutes";
import { formatDate } from "@/utils/date";
import { hasNewTabModifier } from "@/utils/dom";

import {
  getRemotePipelinesFilterQuery,
  isInvalidPipelineId,
  type RemotePipelineSearchFilters,
} from "./pipelinesSearch";
import { RemotePipelinesFilters } from "./RemotePipelinesFilters";

const COLUMN_NAMES = [
  "Name",
  "ID",
  "User",
  "Created at",
  "Updated at",
  "Current version",
];
const INITIAL_COLUMN_WIDTHS = [25, 15, 20, 12, 12, 16];
const MIN_COLUMN_WIDTH_PERCENT = 8;

interface RemotePipelinesTableProps {
  filters: RemotePipelineSearchFilters;
  onFiltersChange: (filters: RemotePipelineSearchFilters) => void;
}

interface RemotePipelinesPagination {
  backendUrl: string;
  filterQuery?: string;
  tokens: string[];
}

function maxColumnWidthIncrease(widths: number[], index: number) {
  return (
    (Math.min(...widths.slice(index + 1)) - MIN_COLUMN_WIDTH_PERCENT) *
    (widths.length - index - 1)
  );
}

function resizeColumnWidths(widths: number[], index: number, delta: number) {
  const remaining = widths.length - index - 1;
  const maxDelta = maxColumnWidthIncrease(widths, index);
  const change = Math.max(
    MIN_COLUMN_WIDTH_PERCENT - widths[index],
    Math.min(delta, maxDelta),
  );

  return widths.map((width, columnIndex) => {
    if (columnIndex < index) return width;
    if (columnIndex === index) return width + change;
    return width - change / remaining;
  });
}

export function RemotePipelinesTable({
  filters,
  onFiltersChange,
}: RemotePipelinesTableProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const { backendUrl, configured, available, ready } = useBackend();
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
  const [columnWidths, setColumnWidths] = useState(INITIAL_COLUMN_WIDTHS);
  const tableRef = useRef<HTMLTableElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    tableWidth: number;
    widths: number[];
  } | null>(null);
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

  let message: string | undefined;
  if (!ready) message = "Loading pipelines…";
  else if (!configured) message = "Configure a backend to view pipelines.";
  else if (!available) message = "Pipelines are unavailable.";
  else if (invalidId) message = "Enter a complete pipeline ID to search.";
  else if (isLoading) message = "Loading pipelines…";
  else if (error) message = "Failed to load pipelines.";
  else if (pipelines.length === 0) message = "No pipelines found.";

  function stopResizing(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

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
        aria-label="Remote Pipelines"
        aria-busy={isFetching}
        className="table-fixed"
      >
        <TableHeader>
          <TableRow className="text-xs">
            {COLUMN_NAMES.map((name, index) => (
              <TableHead
                key={name}
                scope="col"
                className="relative"
                style={{ width: `${columnWidths[index]}%` }}
              >
                <Text
                  size="xs"
                  weight="medium"
                  className="block truncate"
                  title={name}
                >
                  {name}
                </Text>
                {index < COLUMN_NAMES.length - 1 && (
                  <div
                    role="separator"
                    aria-label={`Resize ${name} column`}
                    aria-orientation="vertical"
                    aria-valuemin={MIN_COLUMN_WIDTH_PERCENT}
                    aria-valuemax={
                      columnWidths[index] +
                      maxColumnWidthIncrease(columnWidths, index)
                    }
                    aria-valuenow={columnWidths[index]}
                    tabIndex={0}
                    title={`Drag or use arrow keys to resize ${name}`}
                    className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring"
                    onPointerDown={(event) => {
                      if (event.button !== 0 || dragRef.current) return;
                      const tableWidth =
                        tableRef.current?.getBoundingClientRect().width;
                      if (!tableWidth) return;
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragRef.current = {
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        tableWidth,
                        widths: columnWidths,
                      };
                    }}
                    onPointerMove={(event) => {
                      const drag = dragRef.current;
                      if (!drag || drag.pointerId !== event.pointerId) return;
                      setColumnWidths(
                        resizeColumnWidths(
                          drag.widths,
                          index,
                          ((event.clientX - drag.startX) / drag.tableWidth) *
                            100,
                        ),
                      );
                    }}
                    onPointerUp={stopResizing}
                    onPointerCancel={stopResizing}
                    onLostPointerCapture={stopResizing}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "ArrowLeft" &&
                        event.key !== "ArrowRight"
                      )
                        return;
                      event.preventDefault();
                      setColumnWidths((widths) =>
                        resizeColumnWidths(
                          widths,
                          index,
                          event.key === "ArrowRight" ? 1 : -1,
                        ),
                      );
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-1/2 w-px bg-border"
                    />
                  </div>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {message ? (
            <TableRow>
              <TableCell colSpan={6} className="whitespace-normal text-center">
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
