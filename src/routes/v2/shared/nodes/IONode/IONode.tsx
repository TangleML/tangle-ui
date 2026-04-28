import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import type { IONodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { IONodeCard } from "./IONodeCard";
import { IONodeSimplified } from "./IONodeSimplified";

type IONodeType = Node<IONodeData, "input" | "output">;
type IONodeProps = NodeProps<IONodeType>;

export interface IONodeViewProps {
  entityId: string;
  name: string;
  type?: string;
  description?: string;
  defaultValue?: string;
  connectedValue: string | null;
  isInput: boolean;
  selected: boolean;
  isHovered: boolean;
  onNodeClick: (event: React.MouseEvent) => void;
}

function typeToString(type: unknown): string | undefined {
  if (type === undefined || type === null) return undefined;
  if (typeof type === "string") return type;
  return JSON.stringify(type);
}

export const IONode = observer(function IONode({
  id,
  data,
  selected,
}: IONodeProps) {
  const { entityId, ioType } = data;
  const { editor } = useSharedStores();
  const showContent = useIsDetailedView();

  const spec = useSpec();
  const isInput = ioType === "input";

  const entity = isInput
    ? spec?.inputs.find((i) => i.$id === entityId)
    : spec?.outputs.find((o) => o.$id === entityId);

  const handleClick = (event: React.MouseEvent) => {
    editor.selectNode(id, ioType, {
      shiftKey: event.shiftKey,
      entityId,
    });
  };

  const name = entity?.name ?? entityId;
  const type = typeToString(entity?.type);
  const description = entity?.description;
  const isHovered = editor.hoveredEntityId === entityId;

  let connectedValue: string | null = null;
  if (!isInput && spec && entity) {
    const binding = [...spec.bindings].find(
      (b) => b.targetEntityId === entityId,
    );
    if (binding) {
      const sourceTask = spec.tasks.find(
        (t) => t.$id === binding.sourceEntityId,
      );
      connectedValue = sourceTask
        ? `${sourceTask.name}.${binding.sourcePortName}`
        : binding.sourcePortName;
    }
  }

  const defaultValue =
    isInput && entity && "defaultValue" in entity
      ? (entity.defaultValue ?? undefined)
      : undefined;

  const viewProps: IONodeViewProps = {
    entityId,
    name,
    type,
    description,
    defaultValue,
    connectedValue,
    isInput,
    selected: !!selected,
    isHovered,
    onNodeClick: handleClick,
  };

  if (!showContent) {
    return <IONodeSimplified {...viewProps} />;
  }

  return <IONodeCard {...viewProps} />;
});
