import { type PointerEvent, useRef, useState } from "react";

import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";

const MIN_COLUMN_WIDTH_PERCENT = 8;

interface ResizableTableHeaderProps {
  columns: readonly { name: string; width: number }[];
  actionsClassName?: string;
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

export function ResizableTableHeader({
  columns,
  actionsClassName = "w-20",
}: ResizableTableHeaderProps) {
  const [columnWidths, setColumnWidths] = useState(() =>
    columns.map((column) => column.width),
  );
  const actionsHeaderRef = useRef<HTMLTableCellElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    tableWidth: number;
    widths: number[];
  } | null>(null);

  function stopResizing(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <TableHeader>
      <TableRow className="text-xs">
        {columns.map(({ name }, index) => (
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
            {index < columns.length - 1 && (
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
                    (event.currentTarget
                      .closest("table")
                      ?.getBoundingClientRect().width ?? 0) -
                    (actionsHeaderRef.current?.getBoundingClientRect().width ??
                      0);
                  if (tableWidth <= 0) return;
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
                      ((event.clientX - drag.startX) / drag.tableWidth) * 100,
                    ),
                  );
                }}
                onPointerUp={stopResizing}
                onPointerCancel={stopResizing}
                onLostPointerCapture={stopResizing}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
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
        <TableHead
          ref={actionsHeaderRef}
          scope="col"
          className={actionsClassName}
        >
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
