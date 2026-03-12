import { useState } from "react";

import type {
  ArtifactDataResponse,
  ArtifactNodeResponse,
} from "@/api/types.gen";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { formatBytes } from "@/utils/string";

import ArtifactURI from "./ArtifactURI";
import ArtifactVisualizer from "./ArtifactVisualizer/ArtifactVisualizer";
import TextVisualizer from "./ArtifactVisualizer/TextVisualizer";

interface IOCellProps {
  name: string;
  type?: string;
  artifact: ArtifactNodeResponse | null | undefined;
}

const IOCell = ({ name, type, artifact }: IOCellProps) => {
  const artifactData = artifact?.artifact_data;
  const inlineValue = artifactData?.value;
  const hasInlineValue = canShowInlineValue(inlineValue);
  const hasDetails = Boolean(artifactData?.uri || hasInlineValue);

  const [isOpen, setIsOpen] = useState(false);

  const artifactType =
    type ?? artifact?.type_name ?? (artifactData?.is_dir ? "Directory" : "Any");

  return (
    <>
      <BlockStack gap="1" className="w-full p-2 border bg-white rounded-md">
        <InlineStack
          gap="2"
          align="space-between"
          blockAlign="center"
          className="w-full"
        >
          <InlineStack gap="4" blockAlign="center">
            <CopyText compact size="sm">
              {name}
            </CopyText>

            <InlineStack gap="2" blockAlign="center">
              <Text size="xs" tone="subdued">
                {artifactType}
              </Text>

              {artifactData?.total_size && (
                <Text size="xs" tone="subdued" font="mono">
                  ({formatBytes(artifactData.total_size)})
                </Text>
              )}
            </InlineStack>
          </InlineStack>

          {artifact && hasDetails && !hasInlineValue && !!type && (
            <ArtifactVisualizer artifact={artifact} name={name} type={type} />
          )}

          {hasInlineValue && (
            <InlineStack gap="1" wrap="nowrap" blockAlign="center">
              <CopyText
                size="xs"
                compact
                className="font-mono text-success line-clamp-2 break-all"
              >
                {inlineValue}
              </CopyText>

              {inlineValue.length > 16 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsOpen(true)}
                >
                  <Icon
                    name="Maximize2"
                    size="xs"
                    className="text-muted-foreground"
                  />
                </Button>
              )}
            </InlineStack>
          )}
        </InlineStack>
        {artifactData?.uri && (
          <ArtifactURI uri={artifactData.uri} isDir={artifactData.is_dir} />
        )}
      </BlockStack>
      {inlineValue && (
        <TextPreview
          open={isOpen}
          title={name}
          value={inlineValue}
          artifactData={artifactData}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default IOCell;

const canShowInlineValue = (
  value: string | null | undefined,
): value is string => {
  if (!value) {
    return false;
  }
  if (value.trim() !== "") {
    return true;
  }
  return false;
};

const TextPreview = ({
  open,
  title,
  value,
  artifactData,
  onClose,
}: {
  open: boolean;
  title: string;
  value: string;
  artifactData?: ArtifactDataResponse;
  onClose: () => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-9/10 flex flex-col">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Complete artifact</DialogDescription>
        {artifactData?.uri && (
          <ArtifactURI uri={artifactData.uri} isDir={artifactData.is_dir} />
        )}
        <TextVisualizer value={value} />
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
