import { useReactFlow } from "@xyflow/react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";

import TooltipButton from "../../Buttons/TooltipButton";
import {
  bringToFront,
  moveBackward,
  moveForward,
  sendToBack,
} from "../FlowCanvas/utils/zIndex";

export const StackingControls = ({
  nodeId,
  onChange,
}: {
  nodeId: string;
  onChange: (newZIndex: number) => void;
}) => {
  const { getNodes } = useReactFlow();

  const updateZIndex = (
    operation: "front" | "back" | "forward" | "backward",
  ) => {
    const nodes = getNodes();
    const currentNode = nodes.find((n) => n.id === nodeId);
    if (!currentNode) return;

    let newZIndex: number;
    switch (operation) {
      case "front":
        newZIndex = bringToFront(currentNode, nodes);
        break;
      case "back":
        newZIndex = sendToBack(currentNode, nodes);
        break;
      case "forward":
        newZIndex = moveForward(currentNode, nodes);
        break;
      case "backward":
        newZIndex = moveBackward(currentNode, nodes);
        break;
    }

    onChange(newZIndex);
  };

  return (
    <InlineStack gap="2">
      <TooltipButton
        size="sm"
        variant="outline"
        onClick={() => updateZIndex("forward")}
        tooltip="Move Forward"
      >
        <Icon name="ArrowUpFromLine" />
      </TooltipButton>
      <TooltipButton
        size="sm"
        variant="outline"
        onClick={() => updateZIndex("backward")}
        tooltip="Move Backward"
      >
        <Icon name="ArrowDownFromLine" />
      </TooltipButton>
      <TooltipButton
        size="sm"
        variant="outline"
        onClick={() => updateZIndex("front")}
        tooltip="Bring to Front"
      >
        <Icon name="ListStart" />
      </TooltipButton>
      <TooltipButton
        size="sm"
        variant="outline"
        onClick={() => updateZIndex("back")}
        tooltip="Send to Back"
      >
        <Icon name="ListEnd" />
      </TooltipButton>
    </InlineStack>
  );
};
