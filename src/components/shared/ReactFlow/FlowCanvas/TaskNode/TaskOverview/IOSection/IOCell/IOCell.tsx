import type { ArtifactNodeResponse } from "@/api/types.gen";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { formatBytes } from "@/utils/string";

import ArtifactURI from "./ArtifactURI";

interface IOCellProps {
  name: string;
  type?: string;
  artifact: ArtifactNodeResponse | null | undefined;
}

const IOCell = ({ name, type, artifact }: IOCellProps) => {
  const artifactData = artifact?.artifact_data;
  const inlineValue = artifactData?.value;
  const hasInlineValue = canShowInlineValue(inlineValue);

  const artifactType =
    type ?? artifact?.type_name ?? (artifactData?.is_dir ? "Directory" : "Any");

  return (
    <BlockStack gap="1" className="w-full p-2 border bg-white rounded-md">
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

      {hasInlineValue && (
        <CopyText
          size="xs"
          compact
          className="font-mono text-success line-clamp-2 break-all"
        >
          {inlineValue}
        </CopyText>
      )}

      {!!artifactData?.uri && (
        <ArtifactURI uri={artifactData.uri} isDir={artifactData.is_dir} />
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
