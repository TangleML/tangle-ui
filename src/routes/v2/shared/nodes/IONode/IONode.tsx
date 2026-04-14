import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { IONodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

type IONodeType = Node<IONodeData, "input" | "output">;
type IONodeProps = NodeProps<IONodeType>;

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

  // For outputs, find the connected task and port name
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

  const bgColor = isInput ? "bg-blue-100" : "bg-violet-100";
  const borderColor = selected
    ? isInput
      ? "border-blue-500"
      : "border-violet-500"
    : isHovered
      ? "border-amber-400 ring-2 ring-amber-300"
      : isInput
        ? "border-blue-300 hover:border-blue-400"
        : "border-violet-300 hover:border-violet-400";

  return (
    <Card
      className={cn(
        "border-2 max-w-60 p-0 cursor-pointer transition-all",
        bgColor,
        borderColor,
      )}
      onClick={handleClick}
    >
      <CardHeader className="p-2">
        <CardTitle className="wrap-break-word text-sm">{name}</CardTitle>
        {description && (
          <Paragraph tone="subdued" className="italic truncate text-xs">
            {description}
          </Paragraph>
        )}
      </CardHeader>
      <CardContent className="p-2 max-w-60">
        <BlockStack gap="2">
          <Paragraph size="xs" font="mono" className="truncate text-slate-700">
            <span className="font-bold">Type:</span> {type ?? "Any"}
          </Paragraph>

          <InlineStack gap="1" className="p-2 bg-white rounded-lg w-full">
            <Paragraph
              size="xs"
              font="mono"
              weight="bold"
              className="text-slate-700"
            >
              Value:
            </Paragraph>
            <Paragraph
              size="xs"
              font="mono"
              tone="subdued"
              className="truncate"
            >
              {isInput
                ? ((entity && "defaultValue" in entity
                    ? entity.defaultValue
                    : null) ?? "No value")
                : (connectedValue ?? "No value")}
            </Paragraph>
          </InlineStack>
        </BlockStack>
        <Handle
          type={isInput ? "source" : "target"}
          position={isInput ? Position.Right : Position.Left}
          id={isInput ? `output_${entityId}` : `input_${entityId}`}
          className={cn(
            "w-3! h-3! border-0! transform-none! bg-gray-500!",
            isInput ? "translate-x-1.5" : "-translate-x-1.5",
          )}
        />
      </CardContent>
    </Card>
  );
});
