import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useSnapshot } from "valtio";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";

import type { TaskNodeData } from "../hooks/useSpecToNodesEdges";
import { editorStore, selectNode } from "../store/editorStore";

type TaskNodeType = Node<TaskNodeData, "task">;
type TaskNodeProps = NodeProps<TaskNodeType>;

/**
 * Check if spec has a graph implementation.
 */
function hasGraphImplementation(
  spec: unknown,
): spec is { implementation: GraphImplementation } {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as { implementation?: unknown };
  return s.implementation instanceof GraphImplementation;
}

export function TaskNode({ id, data, selected }: TaskNodeProps) {
  const { entityId } = data;

  // Access the store directly to get the task entity
  // Valtio tracks mutations automatically since entities are wrapped with proxy()
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;

  // Find the task entity by its stable $id
  const task =
    spec && hasGraphImplementation(spec)
      ? spec.implementation.tasks.findById(entityId)
      : null;

  const handleClick = (event: React.MouseEvent) => {
    selectNode(id, "task", {
      shiftKey: event.shiftKey,
      entityId,
    });
  };

  if (!task) {
    return (
      <Card className="min-w-[180px] max-w-[280px] rounded-xl border-2 border-red-300 p-4">
        <Text size="sm" tone="subdued">
          Task not found: {entityId}
        </Text>
      </Card>
    );
  }

  // Get inputs and outputs from the component spec
  const componentSpec = task.componentRef.spec;
  const inputs = componentSpec?.inputs ?? [];
  const outputs = componentSpec?.outputs ?? [];
  const description = componentSpec?.description ?? "";

  return (
    <Card
      className={cn(
        "min-w-[180px] max-w-[280px] rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer transition-all",
        selected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300",
      )}
      onClick={handleClick}
    >
      <CardHeader className="border-b border-slate-200 px-3 py-2">
        <InlineStack gap="2" wrap="nowrap" blockAlign="center">
          <Icon name="Circle" size="sm" className="text-blue-600 shrink-0" />
          <CardTitle className="truncate text-sm font-medium text-slate-900">
            {task.name}
          </CardTitle>
        </InlineStack>
        {description && (
          <Text
            size="xs"
            tone="subdued"
            className="truncate mt-1"
            title={description}
          >
            {description}
          </Text>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <InlineStack className="divide-x divide-slate-100">
          {/* Inputs */}
          <BlockStack className="flex-1 py-2 px-1 min-w-0">
            {inputs.length > 0 ? (
              inputs.map((input) => (
                <div
                  key={input.name}
                  className="relative flex items-center py-0.5 px-2"
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`input_${input.name}`}
                    className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white !-left-1"
                  />
                  <Text
                    size="xs"
                    tone="subdued"
                    className={cn(
                      "truncate",
                      input.optional && "italic opacity-70",
                    )}
                    title={`${input.name}${input.type ? `: ${input.type}` : ""}`}
                  >
                    {input.name}
                  </Text>
                </div>
              ))
            ) : (
              <Text size="xs" tone="subdued" className="px-2 opacity-50">
                No inputs
              </Text>
            )}
          </BlockStack>

          {/* Outputs */}
          <BlockStack className="flex-1 py-2 px-1 min-w-0">
            {outputs.length > 0 ? (
              outputs.map((output) => (
                <div
                  key={output.name}
                  className="relative flex items-center justify-end py-0.5 px-2"
                >
                  <Text
                    size="xs"
                    tone="subdued"
                    className="truncate"
                    title={`${output.name}${output.type ? `: ${output.type}` : ""}`}
                  >
                    {output.name}
                  </Text>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`output_${output.name}`}
                    className="!w-2.5 !h-2.5 !bg-green-400 !border-2 !border-white !-right-1"
                  />
                </div>
              ))
            ) : (
              <Text
                size="xs"
                tone="subdued"
                className="px-2 opacity-50 text-right"
              >
                No outputs
              </Text>
            )}
          </BlockStack>
        </InlineStack>

        {/* Debug: Annotation keys */}
        {task.annotations.getAll().length > 0 && (
          <BlockStack className="border-t rounded-b-md border-slate-100 px-3 py-1.5 bg-slate-50 overflow-hidden">
            <Text size="xs" tone="subdued" className="font-mono truncate">
              annotations: [
              {task.annotations
                .getAll()
                .map((a) => a.key)
                .join(", ")}
              ]
            </Text>
          </BlockStack>
        )}
      </CardContent>
    </Card>
  );
}
