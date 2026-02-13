import type { ChangeEvent } from "react";
import { useSnapshot } from "valtio";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";

import { renameTask } from "../store/actions";
import { editorStore } from "../store/editorStore";

interface PinnedTaskContentProps {
  /** The entity ID of the task to display */
  entityId: string;
}

/**
 * Content for a pinned task window.
 * Shows details for a specific task, independent of the current selection.
 * Used for shift-click "pinned" windows.
 */
export function PinnedTaskContent({ entityId }: PinnedTaskContentProps) {
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;

  if (
    !spec?.implementation ||
    !(spec.implementation instanceof GraphImplementation)
  ) {
    return <NotFoundState entityId={entityId} />;
  }

  // Get task directly from entities using $id
  const task = spec.implementation.tasks.entities[entityId];
  if (!task) {
    return <NotFoundState entityId={entityId} />;
  }

  const componentSpec = task.componentRef.spec;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== task.name) {
      renameTask(entityId, newName);
    }
  };

  return (
    <BlockStack className="h-full bg-white overflow-y-auto">
      <PanelHeader taskName={task.name} />

      <BlockStack gap="4" className="p-3">
        <BlockStack gap="2">
          <Label htmlFor={`task-name-${entityId}`} className="text-gray-600">
            Name
          </Label>
          <Input
            key={entityId}
            id={`task-name-${entityId}`}
            defaultValue={task.name}
            onBlur={handleNameChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        {componentSpec?.description && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Description</Label>
            <Text size="sm" className="text-gray-500">
              {componentSpec.description}
            </Text>
          </BlockStack>
        )}

        <Separator />

        {componentSpec?.inputs && componentSpec.inputs.length > 0 && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Inputs</Label>
            <BlockStack gap="1">
              {componentSpec.inputs.map((input) => (
                <InlineStack
                  key={input.name}
                  gap="2"
                  className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                >
                  <Text size="xs" weight="semibold" className="text-gray-700">
                    {input.name}
                  </Text>
                  {input.type && (
                    <Text size="xs" className="text-gray-500">
                      : {String(input.type)}
                    </Text>
                  )}
                  {input.optional && (
                    <Text size="xs" className="text-gray-400 italic">
                      (optional)
                    </Text>
                  )}
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        )}

        {componentSpec?.outputs && componentSpec.outputs.length > 0 && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Outputs</Label>
            <BlockStack gap="1">
              {componentSpec.outputs.map((output) => (
                <InlineStack
                  key={output.name}
                  gap="2"
                  className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                >
                  <Text size="xs" weight="semibold" className="text-gray-700">
                    {output.name}
                  </Text>
                  {output.type && (
                    <Text size="xs" className="text-gray-500">
                      : {String(output.type)}
                    </Text>
                  )}
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        )}
      </BlockStack>
    </BlockStack>
  );
}

interface PanelHeaderProps {
  taskName: string;
}

function PanelHeader({ taskName }: PanelHeaderProps) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className="p-3 border-b border-gray-200 bg-gray-50"
    >
      <Icon name="Pin" size="sm" className="shrink-0 text-amber-500" />
      <Text size="sm" weight="semibold" className="text-gray-700 truncate">
        {taskName}
      </Text>
    </InlineStack>
  );
}

interface NotFoundStateProps {
  entityId: string;
}

function NotFoundState({ entityId }: NotFoundStateProps) {
  return (
    <BlockStack className="h-full items-center justify-center p-4 bg-white">
      <Icon name="CircleAlert" size="lg" className="text-gray-300" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        Task not found
      </Text>
      <Text size="xs" tone="subdued" className="text-center font-mono">
        {entityId}
      </Text>
    </BlockStack>
  );
}

