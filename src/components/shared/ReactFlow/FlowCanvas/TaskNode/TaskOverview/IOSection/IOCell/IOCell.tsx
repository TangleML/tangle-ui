import { useState } from "react";

import type { ArtifactNodeResponse } from "@/api/types.gen";
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
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { formatBytes } from "@/utils/string";
import { convertArtifactUriToHTTPUrl } from "@/utils/URL";

interface IOCellProps {
  name: string;
  type?: string;
  artifact: ArtifactNodeResponse | null | undefined;
}

const IOCell = ({ name, type, artifact }: IOCellProps) => {
  const artifactData = artifact?.artifact_data;
  const inlineValue = artifactData?.value;
  const hasInlineValue = canShowInlineValue(inlineValue);

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
          <InlineStack gap="2" wrap="nowrap" blockAlign="center">
            <Link
              href={convertArtifactUriToHTTPUrl(
                artifactData.uri,
                artifactData.is_dir,
              )}
              external
              size="xs"
            >
              Link
            </Link>

            <Text size="md" tone="subdued">
              &bull;
            </Text>

            <CopyText
              size="xs"
              compact
              displayValue="Copy URI"
              className="text-sky-500 hover:text-sky-600"
            >
              {artifactData.uri}
            </CopyText>
          </InlineStack>
        )}
      </BlockStack>
      {inlineValue && (
        <TextPreview
          open={isOpen}
          title={name}
          value={inlineValue}
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
  onClose,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-9/10 flex flex-col">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Complete artifact</DialogDescription>
        <BlockStack className="flex-1 min-h-0 min-w-0 overflow-y-auto wrap-anywhere">
          <Text size="sm">{value}</Text>
        </BlockStack>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
