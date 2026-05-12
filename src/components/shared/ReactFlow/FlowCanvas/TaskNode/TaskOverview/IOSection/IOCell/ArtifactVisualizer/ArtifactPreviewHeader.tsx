import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import ArtifactURI from "../ArtifactURI";

interface ArtifactPreviewHeaderProps {
  name: string;
  type?: string;
  artifactUri?: string | null;
  isDir?: boolean;
  shareUrl?: string | null;
  onShareClick?: () => void;
}

export const ArtifactPreviewHeader = ({
  name,
  type,
  artifactUri,
  isDir,
  shareUrl,
  onShareClick,
}: ArtifactPreviewHeaderProps) => (
  <InlineStack gap="4" blockAlign="center">
    <Heading level={2}>{name}</Heading>
    {!!type && (
      <Text size="xs" tone="subdued" weight="light" className="-ml-2">
        {type}
      </Text>
    )}
    <InlineStack gap="3" wrap="nowrap" blockAlign="center">
      {!!artifactUri && <ArtifactURI uri={artifactUri} isDir={!!isDir} />}
      {shareUrl && onShareClick && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onShareClick}
          {...tracking("pipeline_run.artifact_preview.share")}
        >
          Share
          <Icon name="Share2" size="xs" />
        </Button>
      )}
    </InlineStack>
  </InlineStack>
);
