import { useState } from "react";

import type { ArtifactTableData, ParsedArtifact } from "./utils";
import { MAX_PREVIEW_ROWS } from "./utils";

const INITIAL_PREVIEW_ROWS = 100;
const PREVIEW_BATCH_SIZE = 100;

interface UseRowCapReturn {
  data: ArtifactTableData;
  onLoadMore: (() => void) | undefined;
  onLoadAll: (() => void) | undefined;
}

export function useRowCap(parsed: ParsedArtifact): UseRowCapReturn {
  const [rowCap, setRowCap] = useState(INITIAL_PREVIEW_ROWS);

  const handleLoadMore = () =>
    setRowCap((prev) => Math.min(prev + PREVIEW_BATCH_SIZE, MAX_PREVIEW_ROWS));
  const handleLoadAll = () => setRowCap(MAX_PREVIEW_ROWS);

  const canLoadMore = rowCap < parsed.rows.length;

  return {
    data: {
      headers: parsed.headers,
      rows: parsed.rows.slice(0, rowCap),
      hasMore: canLoadMore || parsed.truncated,
    },
    onLoadMore: canLoadMore ? handleLoadMore : undefined,
    onLoadAll: canLoadMore ? handleLoadAll : undefined,
  };
}
