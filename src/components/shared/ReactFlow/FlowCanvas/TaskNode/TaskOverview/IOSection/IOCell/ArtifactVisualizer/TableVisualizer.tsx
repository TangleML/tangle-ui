import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paragraph } from "@/components/ui/typography";

import {
  type ArtifactTableData,
  DEFAULT_PREVIEW_ROWS,
  MAX_PREVIEW_ROWS,
} from "./utils";

interface TableVisualizerProps {
  data: ArtifactTableData;
  signedUrl: string;
  isFullscreen: boolean;
}

const TableVisualizer = ({
  data,
  signedUrl,
  isFullscreen,
}: TableVisualizerProps) => {
  const displayedRows = isFullscreen
    ? data.rows.slice(0, MAX_PREVIEW_ROWS)
    : data.rows.slice(0, DEFAULT_PREVIEW_ROWS);

  const isShowingAllRows = displayedRows.length >= data.rows.length;

  return (
    <BlockStack gap="2">
      <ArtifactTable headers={data.headers} rows={displayedRows} />
      <InlineStack gap="4">
        <Paragraph tone="subdued" size="xs">
          {isShowingAllRows
            ? `Showing all ${displayedRows.length} rows`
            : `Showing first ${displayedRows.length} rows`}
        </Paragraph>
        {!isShowingAllRows && (
          <Link
            href={signedUrl}
            target="_blank"
            rel="noopener"
            className="text-xs"
          >
            See all
          </Link>
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
  <Table>
    <TableHeader>
      <TableRow>
        {headers.map((h) => (
          <TableHead key={h} className="text-xs">
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
              className="font-mono text-xs truncate"
              title={cell}
            >
              {cell}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
