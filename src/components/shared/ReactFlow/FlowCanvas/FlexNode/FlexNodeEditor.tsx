import { type ChangeEvent, useEffect, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { ColorPicker } from "@/components/ui/color";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph, Text } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";

import { StackingControls } from "../../FlowControls/StackingControls";
import { updateFlexNodeInComponentSpec } from "./interface";
import type { FlexNodeData } from "./types";

interface FlexNodeEditorProps {
  flexNode: FlexNodeData;
  readOnly?: boolean;
}

export const FlexNodeEditor = ({
  flexNode,
  readOnly = false,
}: FlexNodeEditorProps) => {
  const { metadata, zIndex, size, position } = flexNode;

  return (
    <BlockStack gap="4" className="h-full px-2">
      <Text size="lg" weight="semibold" className="wrap-anywhere">
        Sticky Note
      </Text>

      <ContentEditor flexNode={flexNode} readOnly={readOnly} />

      <ColorEditor flexNode={flexNode} readOnly={readOnly} />

      <KeyValueList
        title="Layout"
        items={[
          {
            label: "Size",
            value: `${size.width} x ${size.height}`,
            copyable: true,
          },
          {
            label: "Position",
            value: `${position.x}, ${position.y}`,
            copyable: true,
          },
          {
            label: "Z-Index",
            value: `${zIndex}`,
            copyable: true,
          },
        ]}
      />

      <KeyValueList
        title="Metadata"
        items={[
          {
            label: "Id",
            value: flexNode.id,
            copyable: true,
          },
          {
            label: "Created",
            value: new Date(metadata.createdAt).toLocaleString(),
            copyable: true,
          },
          {
            label: "Author",
            value: metadata.createdBy,
            copyable: true,
          },
        ]}
      />

      {!readOnly && <ZIndexEditor flexNode={flexNode} />}
    </BlockStack>
  );
};

const ContentEditor = ({
  flexNode,
  readOnly,
}: {
  flexNode: FlexNodeData;
  readOnly: boolean;
}) => {
  const {
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    setComponentSpec,
  } = useComponentSpec();

  const { properties } = flexNode;

  const [title, setTitle] = useState(properties.title);
  const [content, setContent] = useState(properties.content);

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const saveChanges = () => {
    const updatedSubgraphSpec = updateFlexNodeInComponentSpec(
      currentSubgraphSpec,
      {
        ...flexNode,
        properties: {
          ...properties,
          title,
          content,
        },
      },
    );

    const newRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );

    setComponentSpec(newRootSpec);
  };

  useEffect(() => {
    setTitle(properties.title);
    setContent(properties.content);
  }, [properties]);

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
            label: "Note",
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
            value={title}
            onChange={handleTitleChange}
            onBlur={saveChanges}
            className="text-sm"
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
            value={content}
            onChange={handleContentChange}
            onBlur={saveChanges}
            className="text-xs"
          />
        </BlockStack>
      </BlockStack>
    </ContentBlock>
  );
};

const ColorEditor = ({
  flexNode,
  readOnly,
}: {
  flexNode: FlexNodeData;
  readOnly: boolean;
}) => {
  const {
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    setComponentSpec,
  } = useComponentSpec();

  const { properties } = flexNode;

  const [backgroundColor, setBackgroundColor] = useState(properties.color);

  const handleBackgroundColorChange = (newColor: string) => {
    setBackgroundColor(newColor);
    saveColors(newColor);
  };

  const saveColors = (newBackgroundColor: string) => {
    const updatedSubgraphSpec = updateFlexNodeInComponentSpec(
      currentSubgraphSpec,
      {
        ...flexNode,
        properties: {
          ...properties,
          color: newBackgroundColor,
        },
      },
    );

    const newRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );

    setComponentSpec(newRootSpec);
  };

  useEffect(() => {
    setBackgroundColor(properties.color);
  }, [properties]);

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
        ]}
      />
    );
  }

  return (
    <ContentBlock title="Color">
      <BlockStack gap="1">
        <InlineStack gap="4" blockAlign="center">
          <Paragraph size="xs">Background</Paragraph>
          <ColorPicker
            title="Background Color"
            color={backgroundColor}
            setColor={handleBackgroundColorChange}
          />
          <CopyText className="text-xs font-mono">{properties.color}</CopyText>
        </InlineStack>
      </BlockStack>
    </ContentBlock>
  );
};

const ZIndexEditor = ({ flexNode }: { flexNode: FlexNodeData }) => {
  const {
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    setComponentSpec,
  } = useComponentSpec();

  const handleStackingControlChange = (newZIndex: number) => {
    const updatedSubgraphSpec = updateFlexNodeInComponentSpec(
      currentSubgraphSpec,
      {
        ...flexNode,
        zIndex: newZIndex,
      },
    );

    const newRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );

    setComponentSpec(newRootSpec);
  };

  return (
    <ContentBlock title="Stacking">
      <StackingControls
        nodeId={flexNode.id}
        onChange={handleStackingControlChange}
      />
    </ContentBlock>
  );
};
