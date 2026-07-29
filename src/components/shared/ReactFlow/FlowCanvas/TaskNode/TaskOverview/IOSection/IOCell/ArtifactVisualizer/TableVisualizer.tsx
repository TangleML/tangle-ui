import { useState } from "react";

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
import useToastNotification from "@/hooks/useToastNotification";
import { downloadBlobAsFile } from "@/utils/URL";

import { type ArtifactColumn, type ArtifactTableData } from "./utils";

/**
 * The full dataset usually lives behind a cross-origin signed URL, where the
 * browser ignores an `<a download>` filename. So the caller hands us a `getBlob`
 * that materializes the bytes same-origin (a fetch, or the in-memory value),
 * and we save them with the correct name — only when the user actually clicks.
 */
export type DownloadFullDataset = {
  filename: string;
  getBlob: () => Promise<Blob>;
};

interface TableVisualizerProps {
  data: ArtifactTableData;
  isFullscreen: boolean;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
  isLoading?: boolean;
  totalRows: number;
  columnCount: number;
  onDownloadSchema?: () => void;
  downloadFull?: DownloadFullDataset;
}

const getRowCountMessage = (
  data: ArtifactTableData,
  totalRows: number,
): string =>
  data.hasMore
    ? `Showing first ${data.rows.length.toLocaleString()} of ${totalRows.toLocaleString()} rows`
    : `Showing all ${totalRows.toLocaleString()} rows`;

const TableVisualizer = ({
  data,
  isFullscreen,
  onLoadMore,
  onLoadAll,
  isLoading = false,
  totalRows,
  columnCount,
  onDownloadSchema,
  downloadFull,
}: TableVisualizerProps) => {
  const limitReached = data.hasMore && !onLoadMore;
  const rowCountMessage = getRowCountMessage(data, totalRows);

  const notify = useToastNotification();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadFull = async () => {
    if (!downloadFull || isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = await downloadFull.getBlob();
      downloadBlobAsFile(blob, downloadFull.filename);
    } catch (error) {
      console.error("Failed to download full dataset:", error);
      notify("Failed to download the dataset. Please try again.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <BlockStack
      gap="2"
      className={isFullscreen ? "h-full min-h-0" : "max-h-100"}
    >
      <InlineStack gap="4" align="space-between" blockAlign="center">
        <Text size="xs" tone="subdued">
          {`${totalRows.toLocaleString()} rows · ${columnCount.toLocaleString()} columns`}
        </Text>
        {onDownloadSchema && (
          <Button variant="link" size="inline-xs" onClick={onDownloadSchema}>
            <Icon name="Download" size="xs" aria-hidden="true" />
            Download schema
          </Button>
        )}
      </InlineStack>
      <ArtifactTable columns={data.columns} rows={data.rows} />
      <InlineStack gap="4" blockAlign="center">
        <Paragraph tone="subdued" size="xs">
          {isLoading ? "Loading…" : rowCountMessage}
        </Paragraph>
        {onLoadMore && (
          <Button
            variant="link"
            size="inline-xs"
            onClick={onLoadMore}
            disabled={isLoading}
          >
            Load more
          </Button>
        )}
        {onLoadAll && (
          <Button
            variant="link"
            size="inline-xs"
            onClick={onLoadAll}
            disabled={isLoading}
          >
            Load max
          </Button>
        )}
        {limitReached && downloadFull && (
          <InlineStack gap="2" blockAlign="center" wrap="nowrap">
            <Text size="xs" tone="subdued">
              Preview limit reached
            </Text>
            <Button
              variant="link"
              size="inline-xs"
              onClick={handleDownloadFull}
              disabled={isDownloading}
            >
              <Icon name="Download" size="xs" aria-hidden="true" />
              {isDownloading ? "Preparing…" : "Download full dataset"}
            </Button>
          </InlineStack>
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
            className="bg-background sticky top-0 z-10 h-auto py-2 align-bottom"
          >
            <BlockStack>
              <Text size="xs">{col.name}</Text>
              {col.type && (
                <Text tone="subdued" size="xs">
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
