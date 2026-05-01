import { observer } from "mobx-react-lite";
import { type ChangeEvent, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { Annotation } from "@/models/componentSpec";
import type { Annotations } from "@/models/componentSpec/annotations";

import { useAnnotationActions } from "./useAnnotationActions";

interface AnnotationsBlockProps {
  annotations: Annotations;
  readonly?: boolean;
  ignoreAnnotationKeys?: string[];
  defaultEditing?: boolean;
  /** When `null`, the list title is omitted (use an outer heading). When omitted, defaults to `"Annotations"`. */
  listTitle?: string | null;
}

export const AnnotationsBlock = observer(function AnnotationsBlock({
  annotations,
  readonly,
  ignoreAnnotationKeys,
  defaultEditing = false,
  listTitle,
}: AnnotationsBlockProps) {
  const [isEditing, setIsEditing] = useState(defaultEditing);

  const ignoredSet = ignoreAnnotationKeys
    ? new Set(ignoreAnnotationKeys)
    : undefined;

  const displayItems = annotations.filter(
    (a) => a.key !== "" && String(a.value) !== "",
  );

  const resolvedListTitle =
    listTitle === null ? undefined : (listTitle ?? "Annotations");

  if (isEditing && !readonly) {
    return (
      <AnnotationEditMode
        annotations={annotations}
        ignoredSet={ignoredSet}
        contentTitle={resolvedListTitle}
      />
    );
  }

  return (
    <KeyValueList
      title={resolvedListTitle}
      items={displayItems.map((a) => ({
        label: a.key,
        value: JSON.stringify(a.value),
      }))}
      titleAction={
        !readonly ? (
          <Button variant="ghost" size="xs" onClick={() => setIsEditing(true)}>
            <Icon name="Pencil" size="xs" /> Edit
          </Button>
        ) : undefined
      }
    />
  );
});

function AnnotationEditMode({
  annotations,
  ignoredSet,
  contentTitle,
}: {
  annotations: Annotations;
  ignoredSet?: Set<string>;
  contentTitle?: string;
}) {
  const { addAnnotation } = useAnnotationActions();

  const editableItems = ignoredSet
    ? annotations.filter((a) => !ignoredSet.has(a.key))
    : [...annotations];

  const actions = (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => addAnnotation(annotations)}
    >
      <Icon name="CirclePlus" size="xs" /> New
    </Button>
  );

  return (
    <ContentBlock title={contentTitle} titleAction={actions}>
      {editableItems.length === 0 ? (
        <Text size="xs" tone="subdued">
          No annotations
        </Text>
      ) : (
        editableItems.map((annotation, idx) => (
          <AnnotationRow
            key={`annotation-${idx}`}
            annotation={annotation}
            index={annotations.findIndex((a) => a === annotation)}
            annotations={annotations}
          />
        ))
      )}
    </ContentBlock>
  );
}

interface AnnotationRowProps {
  annotation: Annotation;
  index: number;
  annotations: Annotations;
}

function AnnotationRow({ annotation, index, annotations }: AnnotationRowProps) {
  const { updateAnnotationKey, updateAnnotationValue, removeAnnotation } =
    useAnnotationActions();

  const handleUpdateKey = (event: ChangeEvent<HTMLInputElement>) => {
    const newKey = event.target.value;
    if (newKey !== annotation.key) {
      updateAnnotationKey(annotations, index, newKey);
    }
  };

  const handleUpdateValue = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = String(event.target.value);
    const currentValue =
      typeof annotation.value === "object"
        ? JSON.stringify(annotation.value)
        : String(annotation.value ?? "");
    if (newValue !== currentValue) {
      updateAnnotationValue(annotations, index, newValue);
    }
  };

  const handleRemove = () => {
    removeAnnotation(annotations, index);
  };

  return (
    <BlockStack gap="1" className="group w-full">
      <Input
        className="w-full font-mono text-xs h-6 border-none px-0 shadow-none text-gray-500"
        placeholder="Key"
        defaultValue={annotation.key}
        onBlur={handleUpdateKey}
      />
      <InlineStack gap="1" wrap="nowrap" className="w-full">
        <Input
          className="w-full font-mono text-sm"
          placeholder="Value"
          defaultValue={
            typeof annotation.value === "object"
              ? JSON.stringify(annotation.value)
              : String(annotation.value ?? "")
          }
          onBlur={handleUpdateValue}
        />
        <Button
          variant="ghost"
          size="xs"
          className="invisible group-hover:visible group-focus-within:visible shrink-0"
          onClick={handleRemove}
        >
          <Icon name="Trash" className="text-destructive" />
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
