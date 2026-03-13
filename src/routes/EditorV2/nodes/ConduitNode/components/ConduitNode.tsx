import type { Node, NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { cn } from "@/lib/utils";
import type { GuidelineOrientation } from "@/models/componentSpec/annotations";
import { pluralize } from "@/utils/string";

import { useSpec } from "../../../providers/SpecContext";
import {
  clearSelection,
  editorStore,
  selectNode,
} from "../../../store/editorStore";
import { getConduits } from "../conduits.actions";

export interface ConduitNodeData extends Record<string, unknown> {
  conduitId: string;
  color: string;
  edgeCount: number;
  orientation: GuidelineOrientation;
  coordinate: number;
}

type ConduitNodeType = Node<ConduitNodeData, "conduit">;
type ConduitNodeProps = NodeProps<ConduitNodeType>;

const cssZoomFactor = "var(--zoom-level, 1)";

export const ConduitNode = observer(function ConduitNode({
  data,
  selected,
}: ConduitNodeProps) {
  const { conduitId, color, edgeCount, orientation } = data;
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
