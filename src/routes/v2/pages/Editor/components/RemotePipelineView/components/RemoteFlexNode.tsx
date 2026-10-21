import type { Node, NodeProps } from "@xyflow/react";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { FlexNodeCard } from "@/routes/v2/shared/nodes/FlexNode/FlexNodeCard";
import { FlexNodeSimplified } from "@/routes/v2/shared/nodes/FlexNode/FlexNodeSimplified";
import type { FlexNodeViewProps } from "@/routes/v2/shared/nodes/FlexNode/flexNodeView";

export function RemoteFlexNode({ data, id }: NodeProps<Node<FlexNodeData>>) {
  const showContent = useIsDetailedView();
  const {
    title,
    content,
    color,
    borderColor,
    titleFontSize = 12,
    contentFontSize = 10,
  } = data.properties;
  const viewProps: FlexNodeViewProps = {
    id,
    title,
    content,
    color,
    borderColor,
    titleFontSize,
    contentFontSize,
    locked: data.locked ?? false,
    readOnly: true,
    selected: false,
    isTransparent: color === "transparent",
    isBorderTransparent: borderColor === "transparent",
    hasContent: !!title || !!content,
  };

  return showContent ? (
    <FlexNodeCard {...viewProps} />
  ) : (
    <FlexNodeSimplified {...viewProps} />
  );
}
