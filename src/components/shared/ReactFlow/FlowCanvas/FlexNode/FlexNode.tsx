import {
  type Node,
  type NodeProps,
  NodeResizer,
  type ResizeDragEvent,
} from "@xyflow/react";
import { useEffect } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";

import { FlexNodeEditor } from "./FlexNodeEditor";
import { updateFlexNodeInComponentSpec } from "./interface";
import type { FlexNodeData } from "./types";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const MIN_SIZE = { width: 50, height: 50 };

const FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const { properties, readOnly } = data;
  const { color, zIndex } = properties;

  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();

  const {
    currentSubgraphSpec,
    currentSubgraphPath,
    componentSpec,
    setComponentSpec,
  } = useComponentSpec();

  const handleResizeEnd = (e: ResizeDragEvent) => {
    const width = Math.max(Math.round(e.x), MIN_SIZE.width);
    const height = Math.max(Math.round(e.y), MIN_SIZE.height);

    const updatedSubgraphSpec = updateFlexNodeInComponentSpec(
      currentSubgraphSpec,
      {
        ...data,
        size: { width, height },
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
    if (selected) {
      setContent(<FlexNodeEditor flexNode={data} readOnly={readOnly} />);
      setContextPanelOpen(true);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [data, readOnly, selected]);

  return (
    <>
      <NodeResizer
        color="var(--edge-selected)"
        isVisible={selected}
        minWidth={50}
        minHeight={50}
        onResizeEnd={handleResizeEnd}
      />
      <div
        key={id}
        className={cn(
          "p-1 rounded-lg border border-gray-200 h-full w-full",
          selected && "ring-2 ring-gray-500",
        )}
        style={{ backgroundColor: color, zIndex }}
      >
        <div className="rounded-sm bg-white/40 p-1 h-full w-full">
          <BlockStack gap="1">
            <Paragraph size="sm" weight="semibold">
              {properties.title}
            </Paragraph>
            <Paragraph size="xs">{properties.content}</Paragraph>
          </BlockStack>
        </div>
      </div>
    </>
  );
};

export default FlexNode;
