import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useSnapshot } from "valtio";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { IONodeData } from "../hooks/useSpecToNodesEdges";
import { editorStore, selectNode } from "../store/editorStore";

type IONodeType = Node<IONodeData, "io">;
type IONodeProps = NodeProps<IONodeType>;

/**
 * Convert type to string for display.
 */
function typeToString(type: unknown): string | undefined {
  if (type === undefined || type === null) return undefined;
  if (typeof type === "string") return type;
  return JSON.stringify(type);
}

export function IONode({ id, data, selected }: IONodeProps) {
  const { entityId, ioType } = data;

  // Access the store directly to get the entity
  // Valtio tracks mutations automatically since entities are wrapped with proxy()
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;

  const isInput = ioType === "input";

  // Find the entity by its stable $id
  const entity = isInput
    ? spec?.inputs.entities[entityId]
    : spec?.outputs.entities[entityId];

  const handleClick = () => {
    selectNode(id, ioType);
  };

  if (!entity) {
    return (
      <Card className="min-w-[120px] max-w-[180px] rounded-xl border-2 border-red-300 p-4">
        <Text size="sm" tone="subdued">
          {isInput ? "Input" : "Output"} not found: {entityId}
        </Text>
      </Card>
    );
  }

  const name = entity.name;
  const type = typeToString(entity.type);
  const description = entity.description;

  return (
    <Card
      className={cn(
        "min-w-[120px] max-w-[180px] rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer transition-all",
        selected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300",
        isInput ? "bg-blue-50" : "bg-green-50",
      )}
      onClick={handleClick}
    >
      <CardHeader className="px-3 py-2.5">
        <InlineStack gap="2" wrap="nowrap" blockAlign="center">
          <Icon
            name={isInput ? "Download" : "Upload"}
            size="sm"
            className={cn(
              "shrink-0",
              isInput ? "text-blue-500" : "text-green-500",
            )}
          />
          <CardTitle className="truncate text-sm font-medium text-slate-800">
            {name}
          </CardTitle>
        </InlineStack>

        {(type || description) && (
          <Text
            size="xs"
            tone="subdued"
            className="truncate mt-1"
            title={description || type}
          >
            {type ?? description}
          </Text>
        )}
      </CardHeader>

      {/* Input nodes have an output handle (they provide data) */}
      {isInput && (
        <Handle
          type="source"
          position={Position.Right}
          id={`output_${name}`}
          className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
        />
      )}

      {/* Output nodes have an input handle (they receive data) */}
      {!isInput && (
        <Handle
          type="target"
          position={Position.Left}
          id={`input_${name}`}
          className="!w-3 !h-3 !bg-green-400 !border-2 !border-white"
        />
      )}
    </Card>
  );
}
