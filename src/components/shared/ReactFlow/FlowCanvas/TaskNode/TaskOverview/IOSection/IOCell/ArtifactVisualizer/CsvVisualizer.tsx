import { Paragraph } from "@/components/ui/typography";

import TableVisualizer, { type DownloadFullDataset } from "./TableVisualizer";
import { fetchArtifactOrThrow, useArtifactFetch } from "./useArtifactFetch";
import { useRowCap } from "./useRowCap";
import { parseCsv, type ParsedArtifact } from "./utils";

interface CsvVisualizerValueProps {
  value: string;
  isFullscreen: boolean;
}

interface CsvVisualizerRemoteProps {
  signedUrl: string;
  isFullscreen: boolean;
}

const CsvContent = ({
  parsed,
  isFullscreen,
  downloadFull,
}: {
  parsed: ParsedArtifact;
  isFullscreen: boolean;
  downloadFull?: DownloadFullDataset;
}) => {
  const { data, onLoadMore, onLoadAll } = useRowCap(parsed);

  if (data.columns.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <TableVisualizer
      data={data}
      isFullscreen={isFullscreen}
      onLoadMore={onLoadMore}
      onLoadAll={onLoadAll}
      totalRows={parsed.totalRows}
      columnCount={parsed.columns.length}
      downloadFull={downloadFull}
    />
  );
};

export const CsvVisualizerValue = ({
  value,
  isFullscreen,
}: CsvVisualizerValueProps) => (
  <CsvContent
    parsed={parseCsv(value)}
    isFullscreen={isFullscreen}
    downloadFull={{
      filename: "data.csv",
      getBlob: async () =>
        new Blob([value], { type: "text/csv;charset=utf-8" }),
    }}
  />
);

export const CsvVisualizerRemote = ({
  signedUrl,
  isFullscreen,
}: CsvVisualizerRemoteProps) => {
  const parsed = useArtifactFetch<ParsedArtifact>(
    "csv",
    signedUrl,
    async (response) => parseCsv(await response.text()),
  );

  return (
    <CsvContent
      parsed={parsed}
      isFullscreen={isFullscreen}
      downloadFull={{
        filename: "data.csv",
        getBlob: async () => (await fetchArtifactOrThrow(signedUrl)).blob(),
      }}
    />
  );
};
