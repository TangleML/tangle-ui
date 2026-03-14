import { observer } from "mobx-react-lite";
import { type ChangeEvent, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { Annotation } from "@/models/componentSpec";
import type { Annotations } from "@/models/componentSpec/annotations";

import {
  addAnnotation,
  removeAnnotation,
  updateAnnotationKey,
  updateAnnotationValue,
} from "./annotations.actions";

interface AnnotationsBlockProps {
  annotations: Annotations;
  readonly?: boolean;
  ignoreAnnotationKeys?: string[];
}

export const AnnotationsBlock = observer(function AnnotationsBlock({
  annotations,
  readonly,
  ignoreAnnotationKeys,
}: AnnotationsBlockProps) {
  const [isEditing, setIsEditing] = useState(false);

  const ignoredSet = ignoreAnnotationKeys
    ? new Set(ignoreAnnotationKeys)
    : undefined;

  const displayItems = annotations.filter(
    (a) => a.key !== "" && String(a.value) !== "",
  );

  if (isEditing && !readonly) {
    return (
      <AnnotationEditMode
        annotations={annotations}
        ignoredSet={ignoredSet}
        onClose={() => setIsEditing(false)}
      />
    );
  }

  return (
    <KeyValueList
      title="Annotations"
      items={displayItems.map((a) => ({
        label: a.key,
        value: String(a.value),
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
  onClose,
}: {
  annotations: Annotations;
  ignoredSet?: Set<string>;
  onClose: () => void;
}) {
  const editableItems = ignoredSet
    ? annotations.filter((a) => !ignoredSet.has(a.key))
    : [...annotations];

  const actions = (
    <>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => addAnnotation(annotations)}
      >
        <Icon name="CirclePlus" size="xs" /> Add
      </Button>
      <Button variant="ghost" size="xs" onClick={onClose}>
        <Icon name="Check" size="xs" /> Done
      </Button>
    </>
  );

  return (
    <ContentBlock title="Annotations" titleAction={actions}>
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
  const handleUpdateKey = (event: ChangeEvent<HTMLInputElement>) => {
    updateAnnotationKey(annotations, index, event.target.value);
  };

  const handleUpdateValue = (event: ChangeEvent<HTMLInputElement>) => {
    updateAnnotationValue(annotations, index, String(event.target.value));
  };

  const handleRemove = () => {
    removeAnnotation(annotations, index);
  };

  return (
    <InlineStack align="space-between" className="group w-full" gap="1">
      <InlineStack wrap="nowrap" className="flex-1" gap="1">
        <Input
          className="w-full font-mono text-sm"
          placeholder="Key"
          defaultValue={annotation.key}
          onBlur={handleUpdateKey}
        />
        <Text className="text-gray-400">:</Text>
      </InlineStack>
      <InlineStack wrap="nowrap" className="flex-1">
        <Input
          className="w-full font-mono text-sm"
          placeholder="Value"
          defaultValue={String(annotation.value ?? "")}
          onBlur={handleUpdateValue}
        />
        <Button
          variant="ghost"
          size="xs"
          className="invisible group-hover:visible group-focus-within:visible"
          onClick={handleRemove}
        >
          <Icon name="Trash" className="text-destructive" />
        </Button>
      </InlineStack>
    </InlineStack>
  );
}
