import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { type PointerEvent, useEffect, useRef, useState } from "react";

import { CopyText } from "@/components/shared/CopyText/CopyText";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { BlockStack } from "@/components/ui/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import { useBackend } from "@/providers/BackendProvider";
import { getDefaultRemoteEditorPath } from "@/routes/editorRoutes";
import { formatDate } from "@/utils/date";

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
const MIN_COLUMN_WIDTH = 8;

interface RemotePipelinesTableProps {
  page: number;
  onPageChange: (page: number, replace?: boolean) => Promise<void>;
  filters: RemotePipelineSearchFilters;
  onFiltersChange: (filters: RemotePipelineSearchFilters) => void;
}

function resizeColumnWidths(widths: number[], index: number, delta: number) {
  const remaining = widths.length - index - 1;
  const maxDelta =
    (Math.min(...widths.slice(index + 1)) - MIN_COLUMN_WIDTH) * remaining;
  const change = Math.max(
    MIN_COLUMN_WIDTH - widths[index],
    Math.min(delta, maxDelta),
  );

  return widths.map((width, columnIndex) => {
    if (columnIndex < index) return width;
    if (columnIndex === index) return width + change;
    return width - change / remaining;
  });
}

export function RemotePipelinesTable({
  page,
  onPageChange,
  filters,
  onFiltersChange,
}: RemotePipelinesTableProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const { backendUrl, configured, available, ready } = useBackend();
  const filterQuery = getRemotePipelinesFilterQuery(filters);
  const invalidId = isInvalidPipelineId(filters.id);
  const [debouncedQuery, setDebouncedQuery] = useState(filterQuery);
  const isDebouncing =
    !invalidId && Boolean(filterQuery) && filterQuery !== debouncedQuery;
  const [previousBackendUrl, setPreviousBackendUrl] = useState(backendUrl);
  const currentPage = previousBackendUrl === backendUrl ? page : 1;
  const [columnWidths, setColumnWidths] = useState(INITIAL_COLUMN_WIDTHS);
  const tableRef = useRef<HTMLTableElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    tableWidth: number;
    widths: number[];
  } | null>(null);
  const canFetch =
    ready && configured && available && !isDebouncing && !invalidId;
  const {
    data,
    isLoading,
    isFetching: isQueryFetching,
    isPlaceholderData,
    error,
  } = useRemotePipelinesPage(backendUrl, currentPage, canFetch, filterQuery);
  const isFetching = isQueryFetching || isDebouncing;
  const pipelines = data?.pipelines ?? [];

  useEffect(() => {
    if (invalidId) return;
    if (!filterQuery) {
      setDebouncedQuery(undefined);
      return;
    }
    const timeout = window.setTimeout(
      () => setDebouncedQuery(filterQuery),
      200,
    );
    return () => window.clearTimeout(timeout);
  }, [filterQuery, invalidId]);

  useEffect(() => {
    if (previousBackendUrl === backendUrl) return;
    if (page === 1) setPreviousBackendUrl(backendUrl);
    else void onPageChange(1, true);
  }, [backendUrl, previousBackendUrl, page, onPageChange]);

  useEffect(() => {
    if (
      data &&
      !isFetching &&
      !invalidId &&
      !isPlaceholderData &&
      data.page !== currentPage
    ) {
      void onPageChange(data.page, true);
    }
  }, [
    data,
    isFetching,
    invalidId,
    isPlaceholderData,
    currentPage,
    onPageChange,
  ]);

  let message: string | undefined;
  if (!ready) message = "Loading remote pipelines…";
  else if (!configured)
    message = "Configure a backend to view remote pipelines.";
  else if (!available) message = "Backend is unavailable.";
  else if (isLoading) message = "Loading remote pipelines…";
  else if (error) message = "Failed to load remote pipelines.";
  else if (pipelines.length === 0) message = "No remote pipelines found.";

  function stopResizing(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <BlockStack gap="4" className="w-full">
      <RemotePipelinesFilters filters={filters} onChange={onFiltersChange} />
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
                <span className="block truncate" title={name}>
                  {name}
                </span>
                {index < COLUMN_NAMES.length - 1 && (
                  <div
                    role="separator"
                    aria-label={`Resize ${name} column`}
                    aria-orientation="vertical"
                    aria-valuemin={MIN_COLUMN_WIDTH}
                    aria-valuemax={
                      columnWidths[index] +
                      (Math.min(...columnWidths.slice(index + 1)) -
                        MIN_COLUMN_WIDTH) *
                        (COLUMN_NAMES.length - index - 1)
                    }
                    aria-valuenow={columnWidths[index]}
                    tabIndex={0}
                    title={`Drag or use arrow keys to resize ${name}`}
                    className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none hover:bg-muted focus-visible:bg-muted focus-visible:outline-ring"
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
              <TableCell
                colSpan={6}
                className="whitespace-normal text-center text-muted-foreground"
              >
                {message}
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
                  if (event.ctrlKey || event.metaKey) {
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
                  <div className="flex min-h-9 items-center">
                    <Link
                      to={getDefaultRemoteEditorPath(pipeline.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="block truncate hover:underline"
                      title={pipeline.pipeline_name ?? "Untitled Pipeline"}
                    >
                      {pipeline.pipeline_name ?? "Untitled Pipeline"}
                    </Link>
                  </div>
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <div className="flex min-h-9 items-center">
                    <CopyText
                      size="xs"
                      className="truncate"
                      copyLabel="Copy pipeline ID"
                    >
                      {pipeline.id}
                    </CopyText>
                  </div>
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
      <nav aria-label="Remote pipelines pagination" className="w-full">
        <PaginationControls
          currentPage={currentPage}
          hasPreviousPage={currentPage > 1}
          hasNextPage={Boolean(data?.nextPageToken)}
          disabled={!canFetch || isFetching}
          onPreviousPage={() => void onPageChange(currentPage - 1)}
          onNextPage={() => {
            if (data?.nextPageToken) {
              void onPageChange(currentPage + 1);
            }
          }}
          onReset={() => void onPageChange(1)}
        />
      </nav>
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
      <div className="flex min-h-9 items-center">
        <span className="block truncate" title={title}>
          {children}
        </span>
      </div>
    </TableCell>
  );
}
