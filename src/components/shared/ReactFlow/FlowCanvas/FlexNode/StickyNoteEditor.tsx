import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph, Text } from "@/components/ui/typography";

import type { FlexNodeData } from "./types";

interface StickyNoteEditorProps {
  stickyNote: FlexNodeData;
  readOnly?: boolean;
}

export const StickyNoteEditor = ({
  stickyNote,
  readOnly = false,
}: StickyNoteEditorProps) => {
  const { properties, size, position } = stickyNote;

  return (
    <BlockStack gap="4" className="h-full px-2">
      <Text size="lg" weight="semibold" className="wrap-anywhere">
        Sticky Note
      </Text>

      <ContentEditor properties={properties} readOnly={readOnly} />

      <ColorEditor properties={properties} readOnly={readOnly} />

      <KeyValueList
        title="Layout"
        items={[
          {
            label: "size",
            value: `${size.width} x ${size.height}`,
            copyable: true,
          },
          {
            label: "position",
            value: `${position.x}, ${position.y}`,
            copyable: true,
          },
          {
            label: "z-index",
            value: `${properties.zIndex}`,
            copyable: true,
          },
        ]}
      />
    </BlockStack>
  );
};

const ContentEditor = ({
  properties,
  readOnly,
}: {
  properties: FlexNodeData["properties"];
  readOnly: boolean;
}) => {
  if (readOnly) {
    return (
      <KeyValueList
        title="Content"
        items={[
          {
            label: "Title",
            value: properties.title,
            copyable: true,
          },
          {
            value: properties.content,
            copyable: true,
          },
        ]}
      />
    );
  }

  return (
    <ContentBlock title="Content">
      <BlockStack gap="2">
        <BlockStack>
          <Label
            htmlFor="flex-node-title"
            className="text-muted-foreground text-xs"
          >
            Title
          </Label>
          <Input
            id="flex-node-title"
            value={properties.title}
            className="text-sm"
            readOnly
          />
        </BlockStack>
        <BlockStack>
          <Label
            htmlFor="flex-node-content"
            className="text-muted-foreground text-xs"
          >
            Note
          </Label>
          <Textarea
            id="flex-node-content"
            value={properties.content}
            className="text-xs"
            readOnly
          />
        </BlockStack>
      </BlockStack>
    </ContentBlock>
  );
};

const ColorEditor = ({
  properties,
  readOnly,
}: {
  properties: FlexNodeData["properties"];
  readOnly: boolean;
}) => {
  if (readOnly) {
    return (
      <KeyValueList
        title="Color"
        items={[
          {
            label: "Backgroud",
            value: properties.color,
            copyable: true,
          },
          {
            label: "Border",
            value: properties.border,
            copyable: true,
          },
        ]}
      />
    );
  }

  return (
    <ContentBlock title="Color">
      <BlockStack gap="1">
        <InlineStack gap="4" blockAlign="center">
          <Paragraph size="xs">Background</Paragraph>
          <div
            className="aspect-square h-4 rounded-full border border-muted-foreground"
            style={{ backgroundColor: properties.color }}
          />
          <CopyText className="text-xs font-mono">{properties.color}</CopyText>
        </InlineStack>
        <InlineStack gap="4" blockAlign="center">
          <Paragraph size="xs">Border</Paragraph>
          <div
            className="aspect-square h-4 rounded-full border border-muted-foreground"
            style={{ backgroundColor: properties.border }}
          />
          <CopyText className="text-xs font-mono">{properties.border}</CopyText>
        </InlineStack>
      </BlockStack>
    </ContentBlock>
  );
};
