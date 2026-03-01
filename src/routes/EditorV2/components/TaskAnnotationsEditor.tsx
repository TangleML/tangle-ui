import { type ChangeEvent, useRef } from "react";
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

  // Create a stable dummy object for when spec is null
  // This allows useSnapshot to be called unconditionally
  const dummySpec = useRef({ name: "" });

  // Subscribe to spec changes to trigger re-renders when annotations change
  // The rootSpec is wrapped in ref() in navigationStore, so we need direct subscription
  const specSnapshot = useSnapshot(spec ?? dummySpec.current);

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

  // Access annotations through snapshot to establish Valtio subscription
  // Cast snapshot to access nested task annotations (readonly view)
  const taskSnapshot = (
    specSnapshot as {
      implementation?: {
        tasks?: {
          entities: Record<
            string,
            {
              annotations: {
                entities: Record<string, { key: string; value: unknown }>;
              };
            }
          >;
        };
      };
    }
  ).implementation?.tasks?.entities[entityId];

  // Read annotation key and value from snapshot to establish subscription
  // Reading just Object.keys() only subscribes to entity count, not value changes
  const annotationEntities = taskSnapshot?.annotations?.entities ?? {};
  const annotationFingerprint = Object.values(annotationEntities)
    .map((a) => `${a.key}:${a.value}`)
    .join(",");
  void annotationFingerprint;

  // Filter out internal annotations (editor.*)
  const userAnnotations = task.annotations
    .getAll()
    .filter((a) => !a.key.startsWith("editor."));

  // Handlers mutate the task proxy directly - no need to re-traverse navigation
  const handleAddAnnotation = () => {
    task.annotations.add({ key: "", value: "" });
  };

  const handleUpdateKey = (
    annotationId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const annotation = task.annotations.findById(annotationId);
    if (annotation) {
      annotation.key = event.target.value;
    }
  };

  const handleUpdateValue = (
    annotationId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const annotation = task.annotations.findById(annotationId);
    if (annotation) {
      annotation.value = event.target.value;
    }
  };

  const handleRemoveAnnotation = (annotationId: string) => {
    task.annotations.removeById(annotationId);
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
