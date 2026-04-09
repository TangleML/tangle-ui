import IOCodeViewer from "../IOCodeViewer";
import { useArtifactFetch } from "./useArtifactFetch";

interface JsonVisualizerValueProps {
  name: string;
  value: string;
}

interface JsonVisualizerRemoteProps {
  name: string;
  signedUrl: string;
}

export const JsonVisualizerValue = ({
  name,
  value,
}: JsonVisualizerValueProps) => <IOCodeViewer title={name} value={value} />;

export const JsonVisualizerRemote = ({
  name,
  signedUrl,
}: JsonVisualizerRemoteProps) => {
  const content = useArtifactFetch("json", signedUrl, (r) => r.text());
  return <IOCodeViewer title={name} value={content} />;
};
