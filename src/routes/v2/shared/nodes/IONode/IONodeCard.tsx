import { Handle, Position } from "@xyflow/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Surface } from "@/components/ui/patterns/surface";
import { Paragraph, Text } from "@/components/ui/typography";
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
      density="compact"
      className={cn(
        "border-2 max-w-60 cursor-pointer transition-all",
        bgColor,
        borderColor,
      )}
      onClick={onNodeClick}
    >
      <CardHeader density="compact">
        <CardTitle>
          <Text size="sm" weight="semibold" wrap="break-word">
            {name}
          </Text>
        </CardTitle>
        {description && (
          <Paragraph size="xs" tone="subdued" italic truncate>
            {description}
          </Paragraph>
        )}
      </CardHeader>
      <CardContent density="compact">
        <BlockStack gap="2">
          <Paragraph size="xs" font="mono" truncate tone="strong">
            <Text weight="bold">Type:</Text> {type ?? "Any"}
          </Paragraph>

          <Surface>
            <InlineStack gap="1">
              <Paragraph size="xs" font="mono" weight="bold" tone="strong">
                Value:
              </Paragraph>
              <Paragraph size="xs" font="mono" tone="subdued" truncate>
                {isInput
                  ? (defaultValue ?? "No value")
                  : (connectedValue ?? "No value")}
              </Paragraph>
            </InlineStack>
          </Surface>
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
