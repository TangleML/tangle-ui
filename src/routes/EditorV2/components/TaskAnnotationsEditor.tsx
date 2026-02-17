import type { ChangeEvent } from "react";
import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";

import { getCurrentSpec, navigationStore } from "../store/navigationStore";

interface TaskAnnotationsEditorProps {
  entityId: string;
}

/**
 * Editor for task annotations, displayed in the ContextPanel.
 * Follows the visual pattern from YamlGeneratorOptionsEditor.
 * Uses direct Valtio mutations on the annotations collection.
 */
export function TaskAnnotationsEditor({
  entityId,
}: TaskAnnotationsEditorProps) {
  // Subscribe to navigation changes to trigger re-renders
  const navSnapshot = useSnapshot(navigationStore);
  void navSnapshot.navigationPath.length;

  // Get the current spec from navigation state
  const spec = getCurrentSpec();

  if (
    !spec?.implementation ||
    !(spec.implementation instanceof GraphImplementation)
  ) {
    return null;
  }

  const task = spec.implementation.tasks.findById(entityId);
  if (!task) {
    return null;
  }

  // Filter out internal annotations (editor.*)
  const userAnnotations = task.annotations
    .getAll()
    .filter((a) => !a.key.startsWith("editor."));

  const handleAddAnnotation = () => {
    // Get mutable task from current spec (not snapshot)
    const mutableSpec = getCurrentSpec();
    const mutableTask =
      mutableSpec?.implementation?.tasks?.entities[entityId];
    if (mutableTask) {
      mutableTask.annotations.add({ key: "", value: "" });
    }
  };

  const handleUpdateKey = (
    annotationId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const mutableSpec = getCurrentSpec();
    const mutableTask =
      mutableSpec?.implementation?.tasks?.entities[entityId];
    if (!mutableTask) return;

    const annotation = mutableTask.annotations.findById(annotationId);
    if (annotation) {
      annotation.key = event.target.value;
    }
  };

  const handleUpdateValue = (
    annotationId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const mutableSpec = getCurrentSpec();
    const mutableTask =
      mutableSpec?.implementation?.tasks?.entities[entityId];
    if (!mutableTask) return;

    const annotation = mutableTask.annotations.findById(annotationId);
    if (annotation) {
      annotation.value = event.target.value;
    }
  };

  const handleRemoveAnnotation = (annotationId: string) => {
    const mutableSpec = getCurrentSpec();
    const mutableTask =
      mutableSpec?.implementation?.tasks?.entities[entityId];
    if (mutableTask) {
      mutableTask.annotations.removeById(annotationId);
    }
  };

  return (
    <BlockStack gap="3">
      <BlockStack>
        <InlineStack align="space-between" className="w-full">
          <Text size="sm" weight="semibold" className="text-gray-700">
            Annotations
          </Text>
          <Button variant="ghost" size="xs" onClick={handleAddAnnotation}>
            <Icon name="CirclePlus" /> Add
          </Button>
        </InlineStack>
        <Text size="xs" tone="subdued">
          Custom metadata for this task. Internal annotations are hidden.
        </Text>
      </BlockStack>

      <BlockStack gap="1">
        {userAnnotations.map((annotation) => (
          <InlineStack
            key={annotation.$id}
            align="space-between"
            className="w-full group"
            gap="1"
          >
            <InlineStack wrap="nowrap" className="flex-1" gap="1">
              <Input
                className="w-full font-mono text-sm"
                placeholder="Key"
                defaultValue={annotation.key}
                onBlur={(e) => handleUpdateKey(annotation.$id, e)}
              />
              <Text className="text-gray-400">:</Text>
            </InlineStack>
            <InlineStack wrap="nowrap" className="flex-1">
              <Input
                className="w-full font-mono text-sm"
                placeholder="Value"
                defaultValue={String(annotation.value ?? "")}
                onBlur={(e) => handleUpdateValue(annotation.$id, e)}
              />
              <Button
                variant="ghost"
                size="xs"
                className="group-hover:visible group-focus-within:visible invisible"
                onClick={() => handleRemoveAnnotation(annotation.$id)}
              >
                <Icon name="Trash" className="text-destructive" />
              </Button>
            </InlineStack>
          </InlineStack>
        ))}
      </BlockStack>
    </BlockStack>
  );
}
