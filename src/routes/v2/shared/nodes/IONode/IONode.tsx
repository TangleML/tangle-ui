import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { IONodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const ioNodeCardVariants = cva(
  "min-w-[120px] max-w-[180px] rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer transition-all",
  {
    variants: {
      selected: { true: "", false: "" },
      hovered: { true: "", false: "" },
      isInput: { true: "bg-blue-50", false: "bg-green-50" },
    },
    compoundVariants: [
      {
        selected: false,
        hovered: false,
        className: "border-gray-200 hover:border-gray-300",
      },
      {
        selected: false,
        hovered: true,
        className: "ring-2 ring-amber-300 border-amber-400",
      },
      {
        selected: true,
        className: "border-blue-500 ring-2 ring-blue-200",
      },
    ],
    defaultVariants: {
      selected: false,
      hovered: false,
      isInput: true,
    },
  },
);

const ioNodeIconVariants = cva("shrink-0", {
  variants: {
    isInput: { true: "text-blue-500", false: "text-green-500" },
  },
  defaultVariants: { isInput: true },
});

type IONodeType = Node<IONodeData, "input" | "output">;
type IONodeProps = NodeProps<IONodeType>;

/**
 * Convert type to string for display.
 */
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

  return (
    <Card
      className={ioNodeCardVariants({
        selected: !!selected,
        hovered: isHovered,
        isInput,
      })}
      onClick={handleClick}
    >
      <CardHeader className="px-3 py-2.5">
        <InlineStack gap="2" wrap="nowrap" blockAlign="center">
          <Icon
            name={isInput ? "Download" : "Upload"}
            size="sm"
            className={ioNodeIconVariants({ isInput })}
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

      {isInput && (
        <Handle
          type="source"
          position={Position.Right}
          id={`output_${entityId}`}
          className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
        />
      )}

      {!isInput && (
        <Handle
          type="target"
          position={Position.Left}
          id={`input_${entityId}`}
          className="!w-3 !h-3 !bg-green-400 !border-2 !border-white"
        />
      )}
    </Card>
  );
});
