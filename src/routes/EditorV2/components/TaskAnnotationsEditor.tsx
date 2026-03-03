import { observer } from "mobx-react-lite";
import { type ChangeEvent } from "react";

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
 * Uses mobx-keystone model actions for annotations.
 */
export const TaskAnnotationsEditor = observer(function TaskAnnotationsEditor({
  entityId,
}: TaskAnnotationsEditorProps) {
  const spec = useSpec();
  const task = spec?.tasks.find((t) => t.$id === entityId);

  if (!spec || !task) {
    return null;
  }

  const userAnnotations = task.annotations.filter(
    (a) => !a.key.startsWith("editor."),
  );

  const handleAddAnnotation = () => {
    task.addAnnotation({ key: "", value: "" });
  };

  const handleUpdateKey = (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    task.updateAnnotation(index, { key: event.target.value });
  };

  const handleUpdateValue = (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    task.updateAnnotation(index, { value: event.target.value });
  };

  const handleRemoveAnnotation = (index: number) => {
    task.removeAnnotation(index);
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
            key={`annotation-${idx}`}
            annotation={annotation}
            index={task.annotations.findIndex((a) => a === annotation)}
            onUpdateKey={handleUpdateKey}
            onUpdateValue={handleUpdateValue}
            onRemove={handleRemoveAnnotation}
          />
        ))}
      </BlockStack>
    </BlockStack>
  );
});

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
