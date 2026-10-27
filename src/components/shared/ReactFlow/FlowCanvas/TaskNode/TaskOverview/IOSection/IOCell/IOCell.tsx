import type { ArtifactNodeResponse } from "@/api/types.gen";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { formatBytes } from "@/utils/string";
import { parseHttpUrl } from "@/utils/URL";

import ArtifactURI from "./ArtifactURI";
import {
  inferTypeFromUri,
  normalizeRawType,
  resolveArtifactType,
} from "./ArtifactVisualizer/artifactType";
import ArtifactVisualizer from "./ArtifactVisualizer/ArtifactVisualizer";
import { UrlValue } from "./ArtifactVisualizer/UrlVisualizer";
import { MAX_VISUALIZABLE_SIZE_BYTES } from "./ArtifactVisualizer/utils";

interface IOCellProps {
  name: string;
  type?: string;
  artifact: ArtifactNodeResponse | null | undefined;
  secretName?: string | null;
}

const IOCell = ({ name, type, artifact, secretName }: IOCellProps) => {
  const artifactData = artifact?.artifact_data;
  const inlineValue = artifactData?.value;
  const hasInlineValue = canShowInlineValue(inlineValue);
  const inlineUrl = parseHttpUrl(inlineValue);
  const hasDetails = Boolean(artifactData?.uri || hasInlineValue);

  const artifactType =
    type ?? artifact?.type_name ?? (artifactData?.is_dir ? "Directory" : "Any");

  const rawType = type ?? artifact?.type_name;
  const detectedType = rawType
    ? resolveArtifactType(normalizeRawType(rawType))
    : inferTypeFromUri(artifactData?.uri);
  const isRangeReadable = detectedType === "apacheparquet";
  const isTooLargeToVisualize =
    !hasInlineValue &&
    !isRangeReadable &&
    !!artifactData?.total_size &&
    artifactData.total_size > MAX_VISUALIZABLE_SIZE_BYTES;

  return (
    <BlockStack gap="1" className="w-full p-2 border bg-card rounded-md">
      <InlineStack
        gap="2"
        blockAlign="center"
        align="space-between"
        className="w-full"
      >
        <CopyText compact size="sm" className="break-all">
          {name}
        </CopyText>

        <InlineStack gap="2" blockAlign="center">
          <Text size="xs" tone="subdued">
            {artifactType}
          </Text>

          {!!artifactData?.total_size && (
            <Text size="xs" tone="subdued" font="mono">
              ({formatBytes(artifactData.total_size)})
            </Text>
          )}
        </InlineStack>
      </InlineStack>

      <InlineStack
        gap="2"
        blockAlign="center"
        align="space-between"
        className="w-full"
        wrap="nowrap"
      >
        {hasInlineValue &&
          (inlineUrl ? (
            <UrlValue url={inlineUrl} size="xs" />
          ) : (
            <CopyText
              size="xs"
              compact
              className="font-mono text-success line-clamp-2 break-all"
            >
              {inlineValue}
            </CopyText>
          ))}

        {!artifactData?.uri &&
          artifact &&
          hasDetails &&
          !isTooLargeToVisualize && (
            <ArtifactVisualizer
              artifact={artifact}
              name={name}
              type={artifactType}
              value={hasInlineValue ? inlineValue : undefined}
            />
          )}
      </InlineStack>

      {!!artifactData?.uri && (
        <InlineStack
          gap="2"
          blockAlign="center"
          align="space-between"
          className="w-full"
        >
          <ArtifactURI uri={artifactData.uri} isDir={artifactData.is_dir} />

          {artifact && hasDetails && !isTooLargeToVisualize && (
            <ArtifactVisualizer
              artifact={artifact}
              name={name}
              type={artifactType}
              value={hasInlineValue ? inlineValue : undefined}
            />
          )}
        </InlineStack>
      )}

      {secretName && (
        <InlineStack
          gap="1"
          blockAlign="center"
          wrap="nowrap"
          data-testid="secret-input"
        >
          <Icon
            name="Lock"
            size="xs"
            className="shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <Text size="xs" className="break-all text-amber-600">
            <span className="sr-only">Secret: </span>
            {secretName}
          </Text>
        </InlineStack>
      )}

      {!hasDetails && !secretName && (
        <Text size="xs" tone="subdued">
          No data available
        </Text>
      )}
    </BlockStack>
  );
};

export default IOCell;

const canShowInlineValue = (
  value: string | null | undefined,
): value is string => {
  if (!value) {
    return false;
  }
  if (String(value).trim() !== "") {
    return true;
  }
  return false;
};
