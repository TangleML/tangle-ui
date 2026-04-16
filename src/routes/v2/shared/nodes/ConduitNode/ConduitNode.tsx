import type { Node, NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { cn } from "@/lib/utils";
import type { ConduitNodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { pluralize } from "@/utils/string";

import { getConduits } from "./conduit.utils";

type ConduitNodeType = Node<ConduitNodeData, "conduit">;
type ConduitNodeProps = NodeProps<ConduitNodeType>;

const cssZoomFactor = "var(--zoom-level, 1)";

export const ConduitNode = observer(function ConduitNode({
  data,
  selected,
}: ConduitNodeProps) {
  const { conduitId, color, edgeCount, orientation } = data;
  const { editor } = useSharedStores();
  const spec = useSpec();

  const conduit = spec
    ? getConduits(spec).find((c) => c.id === conduitId)
    : undefined;

  const displayColor = conduit?.color ?? color;
  const assignedCount = conduit?.edgeIds.length ?? edgeCount;
  const isActive =
    editor.selectedNodeId === conduitId &&
    editor.selectedNodeType === "conduit";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      editor.clearSelection();
    } else {
      editor.selectNode(conduitId, "conduit");
    }
  };

  const isVertical = orientation === "vertical";

  return (
    <div
      data-testid="conduit-node"
      className={cn(
        "cursor-pointer transition-opacity",
        isActive
          ? "opacity-60 ring-2 ring-offset-1"
          : selected
            ? "opacity-40"
            : "opacity-5 hover:opacity-60",
      )}
      style={{
        backgroundColor: displayColor,
        width: isVertical ? `calc(3 / ${cssZoomFactor} * 1px)` : "100%",
        height: isVertical ? "100%" : `calc(3 / ${cssZoomFactor} * 1px)`,
        ...(isActive ? { ringColor: displayColor } : {}),
      }}
      title={`Guideline ${isVertical ? "vertical" : "horizontal"} (${assignedCount} ${pluralize(assignedCount, "edge", "edges")})`}
      onClick={handleClick}
    />
  );
});
