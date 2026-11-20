import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { type MouseEvent } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { InputClusterNodeCard } from "./InputClusterNodeCard";
import type { InputClusterNodeData } from "./types";

type InputClusterNodeType = Node<InputClusterNodeData, "inputCluster">;
type InputClusterNodeProps = NodeProps<InputClusterNodeType>;

export const InputClusterNode = observer(function InputClusterNode({
  data,
}: InputClusterNodeProps) {
  const { editor } = useSharedStores();
  const { members } = data;

  const handleMemberClick = (entityId: string, event: MouseEvent) => {
    editor.selectNode(entityId, "input", {
      shiftKey: event.shiftKey,
      entityId,
    });
  };

  const selected =
    editor.selectedNodeType === "input" &&
    members.some((member) => member.entityId === editor.selectedNodeId);

  return (
    <InputClusterNodeCard
      members={members}
      selected={selected}
      hoveredEntityId={editor.hoveredEntityId}
      onMemberClick={handleMemberClick}
    />
  );
});
