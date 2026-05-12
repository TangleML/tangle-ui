import { Paragraph } from "@/components/ui/typography";

import TableVisualizer from "./TableVisualizer";
import { useArtifactFetch } from "./useArtifactFetch";
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
}: {
  parsed: ParsedArtifact;
  isFullscreen: boolean;
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
    />
  );
};

export const CsvVisualizerValue = ({
  value,
  isFullscreen,
}: CsvVisualizerValueProps) => (
  <CsvContent parsed={parseCsv(value)} isFullscreen={isFullscreen} />
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

  return <CsvContent parsed={parsed} isFullscreen={isFullscreen} />;
};
