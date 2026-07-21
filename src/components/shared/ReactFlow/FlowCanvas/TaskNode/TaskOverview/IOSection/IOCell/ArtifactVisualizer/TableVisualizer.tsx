import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paragraph, Text } from "@/components/ui/typography";

import { type ArtifactColumn, type ArtifactTableData } from "./utils";

interface TableVisualizerProps {
  data: ArtifactTableData;
  isFullscreen: boolean;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
  /** Total row count from file metadata (may exceed the previewed rows). */
  totalRows?: number;
  /** Total column count from file metadata. */
  columnCount?: number;
  /** When provided, renders a "Download schema" action in the stats header. */
  onDownloadSchema?: () => void;
}

const getRowCountMessage = (
  data: ArtifactTableData,
  limitReached: boolean,
): string => {
  if (!data.hasMore) return `Showing all ${data.rows.length} rows`;
  if (limitReached)
    return `Showing first ${data.rows.length} rows (preview limit reached)`;
  return `Showing first ${data.rows.length} rows`;
};

const TableVisualizer = ({
  data,
  isFullscreen,
  onLoadMore,
  onLoadAll,
  totalRows,
  columnCount,
  onDownloadSchema,
}: TableVisualizerProps) => {
  const limitReached = data.hasMore && !onLoadMore;
  const rowCountMessage = getRowCountMessage(data, limitReached);

  const hasStats = totalRows !== undefined || columnCount !== undefined;
  const showHeader = hasStats || !!onDownloadSchema;

  return (
    <BlockStack
      gap="2"
      className={isFullscreen ? "h-full min-h-0" : "max-h-100"}
    >
      {showHeader && (
        <InlineStack gap="4" align="space-between" blockAlign="center">
          {hasStats && (
            <Text size="xs" tone="subdued">
              {[
                totalRows !== undefined && `${totalRows.toLocaleString()} rows`,
                columnCount !== undefined &&
                  `${columnCount.toLocaleString()} columns`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
          {onDownloadSchema && (
            <Button variant="link" size="inline-xs" onClick={onDownloadSchema}>
              <Icon name="Download" size="xs" />
              Download schema
            </Button>
          )}
        </InlineStack>
      )}
      <ArtifactTable columns={data.columns} rows={data.rows} />
      <InlineStack gap="4">
        <Paragraph tone="subdued" size="xs">
          {rowCountMessage}
        </Paragraph>
        {onLoadMore && (
          <Button variant="link" size="inline-xs" onClick={onLoadMore}>
            Load more
          </Button>
        )}
        {onLoadAll && (
          <Button variant="link" size="inline-xs" onClick={onLoadAll}>
            Load all
          </Button>
        )}
      </InlineStack>
    </BlockStack>
  );
};

export default TableVisualizer;

interface ArtifactTableProps {
  columns: ArtifactColumn[];
  rows: string[][];
}

const ArtifactTable = ({ columns, rows }: ArtifactTableProps) => (
  <Table containerClassName="flex-1 overflow-auto">
    <TableHeader>
      <TableRow>
        {columns.map((col) => (
          <TableHead
            key={col.name}
            className="bg-background sticky top-0 z-10 h-auto py-2 align-bottom text-xs"
          >
            <BlockStack>
              <Text>{col.name}</Text>
              {col.type && (
                <Text tone="subdued" className="text-[10px]">
                  {col.type}
                  {col.nullable ? "?" : ""}
                </Text>
              )}
            </BlockStack>
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row, i) => (
        <TableRow key={i}>
          {row.map((cell, j) => (
            <TableCell
              key={j}
              className="font-mono text-xs"
              title={String(cell)}
            >
              {String(cell)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
