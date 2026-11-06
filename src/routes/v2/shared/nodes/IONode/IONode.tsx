import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { type MouseEvent } from "react";

import { useHandleEdgeSelection } from "@/hooks/useHandleEdgeSelection";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { NodeEffectWrapper } from "@/routes/v2/shared/components/NodeEffectWrapper";
import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import type { IONodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { isEditorVisualNodeSelected } from "@/routes/v2/shared/store/isEditorVisualNodeSelected";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { getArgumentValue } from "@/utils/nodes/taskArguments";

import { IONodeCard } from "./IONodeCard";
import { IONodeSimplified } from "./IONodeSimplified";

type IONodeType = Node<IONodeData, "input" | "output">;
type IONodeProps = NodeProps<IONodeType>;

export interface IONodeViewProps {
  entityId: string;
  name: string;
  type?: string;
  description?: string;
  value?: string;
  defaultValue?: string;
  argumentValue?: string;
  connectedValue: string | null;
  isInput: boolean;
  selected: boolean;
  isHovered: boolean;
  isConnectable?: boolean;
  onHandleClick: (event: MouseEvent) => void;
  onNodeClick: (event: MouseEvent) => void;
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
  isConnectable,
}: IONodeProps) {
  const { entityId, ioType } = data;
  const { editor, canvasOverlay } = useSharedStores();
  const { selectEdgesForHandle } = useHandleEdgeSelection(id);
  const showContent = useIsDetailedView();
  const executionData = useExecutionDataOptional();

  const spec = useSpec();
  const isInput = ioType === "input";

  const entity = isInput
    ? spec?.inputs.find((i) => i.$id === entityId)
    : spec?.outputs.find((o) => o.$id === entityId);

  const handleClick = (event: MouseEvent) => {
    editor.selectNode(id, ioType, {
      shiftKey: event.shiftKey,
      entityId,
    });
  };

  const handleHandleClick = (event: MouseEvent) => {
    event.stopPropagation();
    selectEdgesForHandle(
      isInput ? `output_${entityId}` : `input_${entityId}`,
      isInput ? "source" : "target",
    );
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

  const taskArguments = executionData?.details?.task_spec.arguments;
  const argumentValue = isInput
    ? getArgumentValue(taskArguments, name)
    : undefined;

  const value =
    isInput && entity && "value" in entity
      ? (entity.value ?? undefined)
      : undefined;

  const isSelected = isEditorVisualNodeSelected(editor, id, !!selected);

  const viewProps: IONodeViewProps = {
    entityId,
    name,
    type,
    description,
    value,
    defaultValue,
    argumentValue,
    connectedValue,
    isInput,
    selected: isSelected,
    isHovered,
    isConnectable,
    onHandleClick: handleHandleClick,
    onNodeClick: handleClick,
  };

  const nodeEffect = canvasOverlay.activeOverlay?.resolveNodeEffect?.(entityId);
  if (nodeEffect?.hidden) return null;

  return (
    <NodeEffectWrapper effect={nodeEffect}>
      {showContent ? (
        <IONodeCard {...viewProps} />
      ) : (
        <IONodeSimplified {...viewProps} />
      )}
    </NodeEffectWrapper>
  );
});
