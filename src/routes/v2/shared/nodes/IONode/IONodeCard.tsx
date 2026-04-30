import { Handle, Position } from "@xyflow/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { IONodeViewProps } from "./IONode";

export function IONodeCard({
  entityId,
  name,
  type,
  description,
  defaultValue,
  connectedValue,
  isInput,
  selected,
  isHovered,
  onNodeClick,
}: IONodeViewProps) {
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
      onClick={onNodeClick}
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
                ? (defaultValue ?? "No value")
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
}
