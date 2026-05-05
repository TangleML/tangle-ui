import { observer } from "mobx-react-lite";

import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import LockToggle from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/LockToggle";
import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { findFlexNode } from "@/routes/v2/pages/Editor/nodes/FlexNode/flexNode.actions";
import { useFlexNodeActions } from "@/routes/v2/pages/Editor/nodes/FlexNode/useFlexNodeActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

import { ColorEditor } from "./components/ColorEditor";
import { ContentEditor } from "./components/ContentEditor";
import { ZIndexEditor } from "./components/ZIndexEditor";

export const FlexNodeDetails = observer(function FlexNodeDetails({
  entityId,
}: {
  entityId: string;
}) {
  const spec = useSpec();
  const flexNode = spec ? findFlexNode(spec, entityId) : undefined;

  if (!spec || !flexNode) return null;

  return <FlexNodeDetailsInner spec={spec} flexNode={flexNode} />;
});

const FlexNodeDetailsInner = observer(function FlexNodeDetailsInner({
  spec,
  flexNode,
}: {
  spec: NonNullable<ReturnType<typeof useSpec>>;
  flexNode: FlexNodeData;
}) {
  const { updateFlexNode, updateFlexNodeProperties } = useFlexNodeActions();
  const { metadata, zIndex, size, position, locked = false } = flexNode;

  const updateCurrentFlexNode = (updates: Partial<FlexNodeData>) => {
    updateFlexNode(spec, flexNode.id, updates);
  };

  const updateProperties = (
    propertyUpdates: Partial<FlexNodeData["properties"]>,
  ) => {
    updateFlexNodeProperties(spec, flexNode.id, propertyUpdates);
  };

  const toggleLock = () => {
    updateCurrentFlexNode({ locked: !locked });
  };

  return (
    <BlockStack gap="4" className="p-3 [&_.text-sm]:text-xs!">
      <InlineStack gap="2" blockAlign="center">
        <Text size="md" weight="semibold" className="wrap-anywhere">
          Sticky Note
        </Text>
        <LockToggle
          locked={locked}
          onToggleLock={toggleLock}
          className={cn(locked && "text-red-500 hover:text-red-500")}
        />
      </InlineStack>

      <ContentEditor
        value={{
          title: flexNode.properties.title,
          content: flexNode.properties.content,
          titleFontSize: flexNode.properties.titleFontSize,
          contentFontSize: flexNode.properties.contentFontSize,
        }}
        onChange={updateProperties}
        readOnly={locked}
      />

      <ColorEditor
        value={{
          color: flexNode.properties.color,
          borderColor: flexNode.properties.borderColor,
        }}
        onChange={updateProperties}
        readOnly={locked}
        hasTextContent={
          Boolean(flexNode.properties.title) ||
          Boolean(flexNode.properties.content)
        }
      />

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

      {!locked && (
        <ZIndexEditor
          nodeId={flexNode.id}
          onChange={(newZIndex) => updateCurrentFlexNode({ zIndex: newZIndex })}
        />
      )}
    </BlockStack>
  );
});
