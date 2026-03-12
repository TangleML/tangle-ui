import { BlockStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";

import { useArtifactFetch } from "./useArtifactFetch";

interface TextVisualizerValueProps {
  value: string;
}

interface TextVisualizerRemoteProps {
  signedUrl: string;
}

const TextContent = ({ content }: { content: string }) => {
  if (content.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <BlockStack className="flex-1 min-h-0 min-w-0 overflow-y-auto wrap-anywhere">
      <Text size="sm">{content}</Text>
    </BlockStack>
  );
};

export const TextVisualizerValue = ({ value }: TextVisualizerValueProps) => (
  <TextContent content={value} />
);

export const TextVisualizerRemote = ({
  signedUrl,
}: TextVisualizerRemoteProps) => {
  const content = useArtifactFetch("text", signedUrl, (r) => r.text());
  return <TextContent content={content} />;
};
