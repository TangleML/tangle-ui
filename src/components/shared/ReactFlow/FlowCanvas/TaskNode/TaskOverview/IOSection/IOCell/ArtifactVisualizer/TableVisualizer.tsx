import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paragraph } from "@/components/ui/typography";

import { type ArtifactTableData } from "./utils";

interface TableVisualizerProps {
  data: ArtifactTableData;
  isFullscreen: boolean;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
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
}: TableVisualizerProps) => {
  const limitReached = data.hasMore && !onLoadMore;
  const rowCountMessage = getRowCountMessage(data, limitReached);

  return (
    <BlockStack
      gap="2"
      className={isFullscreen ? "h-full min-h-0" : "max-h-100"}
    >
      <ArtifactTable headers={data.headers} rows={data.rows} />
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
  headers: string[];
  rows: string[][];
}

const ArtifactTable = ({ headers, rows }: ArtifactTableProps) => (
  <Table containerClassName="flex-1 overflow-auto">
    <TableHeader>
      <TableRow>
        {headers.map((h) => (
          <TableHead
            key={h}
            className="bg-background sticky top-0 z-10 text-xs"
          >
            {h}
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
