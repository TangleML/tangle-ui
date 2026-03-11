import {
  type Node,
  type NodeProps,
  NodeResizer,
  type ResizeParams,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { cn } from "@/lib/utils";

import { useSpec } from "../../../providers/SpecContext";
import {
  clearSelection,
  editorStore,
  selectNode,
} from "../../../store/editorStore";
import { getConduits, updateConduitSize } from "../hooks/useConduits";

export interface ConduitNodeData extends Record<string, unknown> {
  conduitId: string;
  color: string;
  edgeCount: number;
}

type ConduitNodeType = Node<ConduitNodeData, "conduit">;
type ConduitNodeProps = NodeProps<ConduitNodeType>;

const MIN_WIDTH = 20;
const MIN_HEIGHT = 20;

export const ConduitNode = observer(function ConduitNode({
  data,
  selected,
}: ConduitNodeProps) {
  const { conduitId, color, edgeCount } = data;
  const spec = useSpec();

  const conduit = spec
    ? getConduits(spec).find((c) => c.id === conduitId)
    : undefined;

  const displayColor = conduit?.color ?? color;
  const assignedCount = conduit?.edgeIds.length ?? edgeCount;
  const isActive =
    editorStore.selectedNodeId === conduitId &&
    editorStore.selectedNodeType === "conduit";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      clearSelection();
    } else {
      selectNode(conduitId, "conduit");
    }
  };

  const handleResizeEnd = (_: unknown, params: ResizeParams) => {
    if (!spec) return;
    const width = Math.max(params.width, MIN_WIDTH);
    const height = Math.max(params.height, MIN_HEIGHT);
    updateConduitSize(
      spec,
      conduitId,
      { width, height },
      {
        x: params.x,
        y: params.y,
      },
    );
  };

  return (
    <>
      <NodeResizer
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        isVisible={selected || isActive}
        onResizeEnd={handleResizeEnd}
      />
      <div
        data-testid="conduit-node"
        className={cn(
          "w-full h-full cursor-pointer transition-opacity",
          isActive
            ? "opacity-60 ring-2 ring-offset-1"
            : selected
              ? "opacity-40"
              : "opacity-2 hover:opacity-60",
        )}
        style={{
          backgroundColor: displayColor,
          ...(isActive ? { ringColor: displayColor } : {}),
        }}
        title={`Conduit (${assignedCount} edge${assignedCount !== 1 ? "s" : ""})`}
        onClick={handleClick}
      ></div>
    </>
  );
});
