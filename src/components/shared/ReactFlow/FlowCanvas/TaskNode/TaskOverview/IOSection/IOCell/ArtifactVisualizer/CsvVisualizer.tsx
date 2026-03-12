import { Paragraph } from "@/components/ui/typography";

import TableVisualizer from "./TableVisualizer";
import { useArtifactFetch } from "./useArtifactFetch";
import { type ArtifactTableData, parseCsv } from "./utils";

interface CsvVisualizerValueProps {
  value: string;
  remoteLink?: string | null;
  isFullscreen: boolean;
}

interface CsvVisualizerRemoteProps {
  signedUrl: string;
  isFullscreen: boolean;
}

const CsvContent = ({
  data,
  remoteLink,
  isFullscreen,
}: {
  data: ArtifactTableData;
  remoteLink?: string | null;
  isFullscreen: boolean;
}) => {
  if (data.headers.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <TableVisualizer
      data={data}
      remoteLink={remoteLink}
      isFullscreen={isFullscreen}
    />
  );
};

export const CsvVisualizerValue = ({
  value,
  remoteLink,
  isFullscreen,
}: CsvVisualizerValueProps) => (
  <CsvContent
    data={parseCsv(value)}
    remoteLink={remoteLink}
    isFullscreen={isFullscreen}
  />
);

export const CsvVisualizerRemote = ({
  signedUrl,
  isFullscreen,
}: CsvVisualizerRemoteProps) => {
  const data = useArtifactFetch("csv", signedUrl, async (r) =>
    parseCsv(await r.text()),
  );
  return (
    <CsvContent
      data={data}
      remoteLink={signedUrl}
      isFullscreen={isFullscreen}
    />
  );
};
