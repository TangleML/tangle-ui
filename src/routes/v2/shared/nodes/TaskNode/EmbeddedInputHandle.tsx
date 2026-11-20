import { Handle, Position } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import type { MouseEvent as ReactMouseEvent } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { PORT_ROW_HEIGHT } from "@/routes/v2/shared/nodes/nodeLayout";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { tracking } from "@/utils/tracking";

import type { InputConnectionActions } from "./InputConnectionActionsContext";
import type { GraphInputBinding, TaskNodeInput } from "./TaskNode";

interface EmbeddedInputHandleProps {
  input: TaskNodeInput;
  entityId: string;
  binding: GraphInputBinding;
  actions: InputConnectionActions;
}

/**
 * Renders a task input port that is bound to a graph input while embedded mode
 * hides the standalone input node. The port adopts the input-node color and
 * opens a dropdown for switching to another graph input or disconnecting.
 */
export const EmbeddedInputHandle = observer(function EmbeddedInputHandle({
  input,
  entityId,
  binding,
  actions,
}: EmbeddedInputHandleProps) {
  const spec = useSpec();
  const inputs = spec?.inputs ?? [];
  const hasError = spec?.issuesByEntityId
    .get(entityId)
    ?.some(
      (issue) =>
        issue.argumentName === input.name && issue.severity === "error",
    );

  const stopPropagation = (event: ReactMouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="relative w-full"
      style={{ height: PORT_ROW_HEIGHT }}
      onClick={stopPropagation}
    >
      <div className="absolute top-1/2 -translate-x-6 -translate-y-1/2 flex items-center h-3 w-3">
        <Handle
          type="target"
          position={Position.Left}
          id={`input_${input.name}`}
          className={
            hasError
              ? "border-0! h-full! w-full! top-0! transform-none! bg-red-700!"
              : "border-0! h-full! w-full! top-0! transform-none! bg-gray-500!"
          }
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="nodrag w-full flex items-center justify-between gap-1 rounded-md border border-blue-300 bg-io-input px-2 py-0.5 text-xs text-ink-fixed hover:border-blue-400 dark:border-blue-500 dark:hover:border-blue-600 cursor-pointer"
            title={`${input.name}${input.type ? `: ${input.type}` : ""} → ${binding.sourceName}`}
            data-testid={`embedded-input-trigger-${input.name}`}
            {...tracking("v2.pipeline_editor.task_node.embedded_input")}
          >
            <span className="truncate min-w-0">
              {input.name.replace(/_/g, " ")}
            </span>
            <span className="flex items-center gap-1 min-w-0 max-w-1/2">
              <Icon name="Download" size="xs" className="shrink-0" />
              <span className="truncate">{binding.sourceName}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-56 z-[9999]"
        >
          <DropdownMenuLabel>Connect input to</DropdownMenuLabel>
          {inputs.map((graphInput) => (
            <DropdownMenuItem
              key={graphInput.$id}
              disabled={graphInput.$id === binding.sourceEntityId}
              {...tracking(
                "v2.pipeline_editor.task_node.embedded_input.reconnect",
              )}
              onClick={() =>
                actions.changeInputConnection(
                  entityId,
                  input.name,
                  graphInput.$id,
                  graphInput.name,
                )
              }
            >
              <Icon name="Download" size="sm" className="text-blue-600" />
              <span className="truncate flex-1">{graphInput.name}</span>
              {graphInput.$id === binding.sourceEntityId && (
                <Icon name="Check" size="sm" className="shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            {...tracking(
              "v2.pipeline_editor.task_node.embedded_input.disconnect",
            )}
            onClick={() => actions.disconnectInput(entityId, input.name)}
          >
            <Icon name="Unplug" size="sm" className="text-red-600" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
