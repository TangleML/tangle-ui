import { type ChangeEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { Annotation } from "@/models/componentSpec";

import { useSpec } from "../providers/SpecContext";

interface TaskAnnotationsEditorProps {
  entityId: string;
}

/**
 * Editor for task annotations, displayed in the ContextPanel.
 * Follows the visual pattern from YamlGeneratorOptionsEditor.
 * Uses the new model's ObservableArray for annotations.
 */
export function TaskAnnotationsEditor({
  entityId,
}: TaskAnnotationsEditorProps) {
  // Version counter to force re-renders when annotations change
  const [version, setVersion] = useState(0);

  // Get the current spec from SpecContext
  const spec = useSpec();

  const task = spec?.tasks.find((t) => t.$id === entityId);

  // Subscribe to annotation changes using version counter
  useEffect(() => {
    if (!task) return;
    const unsub = task.annotations.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsub;
  }, [task]);

  if (!spec || !task) {
    return null;
  }

  // Access version to ensure React tracks it as a dependency
  void version;

  // Filter out internal annotations (editor.*)
  const userAnnotations = task.annotations.all.filter(
    (a) => !a.key.startsWith("editor."),
  );

  // Handlers mutate the task annotations directly
  const handleAddAnnotation = () => {
    task.annotations.add({ key: "", value: "" });
  };

  const handleUpdateKey = (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    task.annotations.update(index, { key: event.target.value });
  };

  const handleUpdateValue = (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    task.annotations.update(index, { value: event.target.value });
  };

  const handleRemoveAnnotation = (index: number) => {
    task.annotations.remove(index);
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
        {userAnnotations.map((annotation, idx) => (
          <AnnotationRow
            key={`annotation-${idx}-${version}`}
            annotation={annotation}
            index={task.annotations.all.findIndex((a) => a === annotation)}
            onUpdateKey={handleUpdateKey}
            onUpdateValue={handleUpdateValue}
            onRemove={handleRemoveAnnotation}
          />
        ))}
      </BlockStack>
    </BlockStack>
  );
}

interface AnnotationRowProps {
  annotation: Annotation;
  index: number;
  onUpdateKey: (index: number, event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateValue: (index: number, event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}

function AnnotationRow({
  annotation,
  index,
  onUpdateKey,
  onUpdateValue,
  onRemove,
}: AnnotationRowProps) {
  return (
    <InlineStack align="space-between" className="w-full group" gap="1">
      <InlineStack wrap="nowrap" className="flex-1" gap="1">
        <Input
          className="w-full font-mono text-sm"
          placeholder="Key"
          defaultValue={annotation.key}
          onBlur={(e) => onUpdateKey(index, e)}
        />
        <Text className="text-gray-400">:</Text>
      </InlineStack>
      <InlineStack wrap="nowrap" className="flex-1">
        <Input
          className="w-full font-mono text-sm"
          placeholder="Value"
          defaultValue={String(annotation.value ?? "")}
          onBlur={(e) => onUpdateValue(index, e)}
        />
        <Button
          variant="ghost"
          size="xs"
          className="group-hover:visible group-focus-within:visible invisible"
          onClick={() => onRemove(index)}
        >
          <Icon name="Trash" className="text-destructive" />
        </Button>
      </InlineStack>
    </InlineStack>
  );
}
