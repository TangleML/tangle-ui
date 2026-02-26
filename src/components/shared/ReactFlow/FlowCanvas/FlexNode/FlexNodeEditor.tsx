import { type ChangeEvent, useEffect, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { InfoBox } from "@/components/shared/InfoBox";
import { ColorPicker } from "@/components/ui/color";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";

import { StackingControls } from "../../FlowControls/StackingControls";
import { updateFlexNodeInComponentSpec } from "./interface";
import LockToggle from "./LockToggle";
import type { FlexNodeData } from "./types";
import { DEFAULT_BORDER_COLOR } from "./utils";

interface FlexNodeEditorProps {
  flexNode: FlexNodeData;
  readOnly?: boolean;
  toggleLock?: () => void;
}

export const FlexNodeEditor = ({
  flexNode,
  readOnly = false,
  toggleLock,
}: FlexNodeEditorProps) => {
  const { metadata, zIndex, size, position, locked = false } = flexNode;

  return (
    <BlockStack gap="4" className="h-full px-2">
      <InlineStack gap="2" blockAlign="center">
        <Text size="lg" weight="semibold" className="wrap-anywhere">
          Sticky Note
        </Text>
        {toggleLock && (
          <LockToggle
            locked={locked}
            onToggleLock={toggleLock}
            className={cn(locked && "text-red-500 hover:text-red-500")}
          />
        )}
      </InlineStack>

      <ContentEditor flexNode={flexNode} readOnly={readOnly || locked} />

      <ColorEditor flexNode={flexNode} readOnly={readOnly || locked} />

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

      {!readOnly && !locked && <ZIndexEditor flexNode={flexNode} />}
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

  const currentBorderColor = properties.borderColor ?? DEFAULT_BORDER_COLOR;

  const [backgroundColor, setBackgroundColor] = useState(properties.color);
  const [borderColor, setBorderColor] = useState(currentBorderColor);

  const isTransparent = backgroundColor === "transparent";
  const isBorderTransparent = borderColor === "transparent";
  const hasTextContent = properties.title || properties.content;

  const handleBackgroundColorChange = (newColor: string) => {
    setBackgroundColor(newColor);
    saveColors(newColor, borderColor);
  };

  const handleBorderColorChange = (newColor: string) => {
    setBorderColor(newColor);
    saveColors(backgroundColor, newColor);
  };

  const saveColors = (
    newBackgroundColor: string,
    newBorderColor: string | undefined,
  ) => {
    const updatedSubgraphSpec = updateFlexNodeInComponentSpec(
      currentSubgraphSpec,
      {
        ...flexNode,
        properties: {
          ...properties,
          color: newBackgroundColor,
          borderColor: newBorderColor,
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
    setBorderColor(currentBorderColor);
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
          ...(isTransparent
            ? [
                {
                  label: "Border",
                  value: properties.borderColor,
                  copyable: true,
                },
              ]
            : []),
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

        {isTransparent && (
          <InlineStack gap="4" blockAlign="center">
            <Paragraph size="xs">Border</Paragraph>
            <ColorPicker
              title="Border Color"
              color={borderColor}
              setColor={handleBorderColorChange}
            />
            <CopyText className="text-xs font-mono">
              {currentBorderColor}
            </CopyText>
          </InlineStack>
        )}

        {isTransparent && isBorderTransparent && !hasTextContent && (
          <InfoBox title="Invisible Node" variant="warning">
            This sticky note has no visual context. Consider adding a border,
            background or text.
          </InfoBox>
        )}
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
