import { type ChangeEvent } from "react";

import { ColorPicker } from "@/components/ui/color";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpecJson, Task } from "@/models/componentSpec";

interface TaskInfoSectionProps {
  entityId: string;
  task: Task;
  componentSpec: ComponentSpecJson | undefined;
  taskColor: string;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onColorChange: (color: string) => void;
}

export function TaskInfoSection({
  entityId,
  task,
  componentSpec,
  taskColor,
  onNameChange,
  onColorChange,
}: TaskInfoSectionProps) {
  return (
    <BlockStack gap="2">
      <BlockStack gap="1">
        <InlineStack
          gap="2"
          blockAlign="center"
          wrap="nowrap"
          className="w-full"
        >
          <ColorPicker
            title="Task color"
            color={taskColor}
            setColor={onColorChange}
          />
          <Input
            key={`${entityId}-${task.name}`}
            id="task-name"
            defaultValue={task.name}
            onBlur={onNameChange}
            className="font-mono text-xs h-7"
          />
        </InlineStack>
      </BlockStack>

      {componentSpec?.description && (
        <BlockStack gap="1">
          <Text size="xs" className="text-gray-500">
            {componentSpec.description}
          </Text>
        </BlockStack>
      )}
    </BlockStack>
  );
}
