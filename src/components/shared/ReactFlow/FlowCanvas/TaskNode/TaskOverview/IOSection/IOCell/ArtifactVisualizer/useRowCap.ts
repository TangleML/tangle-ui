import { useState } from "react";

import type { ArtifactTableData, ParsedArtifact } from "./utils";
import { getPreviewRowLimit } from "./utils";

const INITIAL_PREVIEW_ROWS = 100;
const PREVIEW_BATCH_SIZE = 100;

interface UseRowCapReturn {
  data: ArtifactTableData;
  onLoadMore: (() => void) | undefined;
  onLoadAll: (() => void) | undefined;
}

export function useRowCap(parsed: ParsedArtifact): UseRowCapReturn {
  const rowLimit = getPreviewRowLimit(parsed.columns.length);
  const [rowCap, setRowCap] = useState(INITIAL_PREVIEW_ROWS);

  const handleLoadMore = () =>
    setRowCap((prev) => Math.min(prev + PREVIEW_BATCH_SIZE, rowLimit));
  const handleLoadAll = () => setRowCap(rowLimit);

  const canLoadMore = rowCap < parsed.rows.length;

  return {
    data: {
      columns: parsed.columns,
      rows: parsed.rows.slice(0, rowCap),
      hasMore: canLoadMore || parsed.truncated,
    },
    onLoadMore: canLoadMore ? handleLoadMore : undefined,
    onLoadAll: canLoadMore ? handleLoadAll : undefined,
  };
}
