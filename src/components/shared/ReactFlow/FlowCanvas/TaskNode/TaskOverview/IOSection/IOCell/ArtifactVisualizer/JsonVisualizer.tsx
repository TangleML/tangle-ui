import IOCodeViewer from "../IOCodeViewer";
import { useArtifactFetch } from "./useArtifactFetch";

interface JsonVisualizerValueProps {
  name: string;
  value: string;
  isFullscreen?: boolean;
}

interface JsonVisualizerRemoteProps {
  name: string;
  signedUrl: string;
  isFullscreen?: boolean;
}

export const JsonVisualizerValue = ({
  name,
  value,
  isFullscreen,
}: JsonVisualizerValueProps) => (
  <IOCodeViewer title={name} value={value} isFullscreen={isFullscreen} />
);

export const JsonVisualizerRemote = ({
  name,
  signedUrl,
  isFullscreen,
}: JsonVisualizerRemoteProps) => {
  const content = useArtifactFetch("json", signedUrl, (r) => r.text());
  return (
    <IOCodeViewer title={name} value={content} isFullscreen={isFullscreen} />
  );
};
