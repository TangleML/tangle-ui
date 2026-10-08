import { useQuery } from "@tanstack/react-query";
import { type PointerEvent, useRef, useState } from "react";

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
import { useBackend } from "@/providers/BackendProvider";
import { listRemotePipelines } from "@/services/remotePipelinesService";
import { formatDate } from "@/utils/date";

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

export function RemotePipelinesTable() {
  const { backendUrl, configured, available, ready } = useBackend();
  const [pagination, setPagination] = useState({
    backendUrl,
    tokens: [] as string[],
    totalCount: 0,
  });
  const pageTokens =
    pagination.backendUrl === backendUrl ? pagination.tokens : [];
  if (pagination.backendUrl !== backendUrl) {
    setPagination({ backendUrl, tokens: [], totalCount: 0 });
  }
  const [columnWidths, setColumnWidths] = useState(INITIAL_COLUMN_WIDTHS);
  const tableRef = useRef<HTMLTableElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    tableWidth: number;
    widths: number[];
  } | null>(null);
  const pageToken = pageTokens.at(-1);
  const canFetch = ready && configured && available;
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["remote-pipelines", backendUrl, pageToken],
    queryFn: () => listRemotePipelines(backendUrl, pageToken),
    enabled: canFetch,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const pipelines = data?.pipelines ?? [];
  const totalCount = data?.totalCount ?? pagination.totalCount;

  function changePage(tokens: string[]) {
    setPagination({ backendUrl, tokens, totalCount });
  }

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
      <Table
        ref={tableRef}
        aria-label="Remote Pipelines"
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
              <TableRow key={pipeline.id}>
                <TruncatedTableCell>
                  {pipeline.pipeline_name ?? "Untitled Pipeline"}
                </TruncatedTableCell>
                <TruncatedTableCell>{pipeline.id}</TruncatedTableCell>
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
          currentPage={pageTokens.length + 1}
          totalPages={Math.max(
            pageTokens.length + 1,
            Math.ceil(totalCount / 10),
          )}
          hasPreviousPage={pageTokens.length > 0}
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
    </BlockStack>
  );
}

function TruncatedTableCell({
  children,
  title = children,
}: {
  children: string;
  title?: string;
}) {
  return (
    <TableCell>
      <span className="block truncate" title={title}>
        {children}
      </span>
    </TableCell>
  );
}
