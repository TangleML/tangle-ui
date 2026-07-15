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
  const bgColor = isInput ? "bg-io-input" : "bg-io-output";
  const borderColor = selected
    ? isInput
      ? "border-blue-500 dark:ring-2 dark:ring-blue-400/60"
      : "border-violet-500 dark:ring-2 dark:ring-violet-400/60"
    : isHovered
      ? "border-amber-400 ring-2 ring-amber-300"
      : isInput
        ? "border-blue-300 hover:border-blue-400 dark:border-blue-500 dark:hover:border-blue-600"
        : "border-violet-300 hover:border-violet-400 dark:border-violet-500 dark:hover:border-violet-600";

  return (
    <Card
      className={cn(
        "border-2 max-w-60 p-0 cursor-pointer transition-all",
        bgColor,
        borderColor,
      )}
      onClick={onNodeClick}
      data-tour-card={isInput ? "input" : "output"}
      data-tour-card-name={name}
    >
      <CardHeader className="p-2">
        <CardTitle className="wrap-break-word text-sm text-ink-fixed">
          {name}
        </CardTitle>
        {description && (
          <Paragraph className="italic truncate text-xs text-ink-fixed/70">
            {description}
          </Paragraph>
        )}
      </CardHeader>
      <CardContent className="py-2 px-4 max-w-60">
        <BlockStack gap="2">
          <Paragraph
            size="xs"
            font="mono"
            className="truncate text-ink-fixed/70"
          >
            <span className="font-bold">Type:</span> {type ?? "Any"}
          </Paragraph>

          <InlineStack gap="1" className="p-2 bg-io-value rounded-lg w-full">
            <Paragraph
              size="xs"
              font="mono"
              weight="bold"
              className="text-ink-fixed/70"
            >
              Value:
            </Paragraph>
            <Paragraph
              size="xs"
              font="mono"
              className="truncate text-ink-fixed/70"
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
