import { observer } from "mobx-react-lite";
import { type FocusEvent, useEffect, useRef, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/models/componentSpec";
import type { Annotations } from "@/models/componentSpec/annotations";

import { useAnnotationActions } from "./useAnnotationActions";

interface AnnotationsBlockProps {
  annotations: Annotations;
  readonly?: boolean;
  systemAnnotationKeys?: string[];
}

interface CategorizedAnnotation {
  annotation: Annotation;
  index: number;
}

function formatAnnotationValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export const AnnotationsBlock = observer(function AnnotationsBlock({
  annotations,
  readonly,
  systemAnnotationKeys,
}: AnnotationsBlockProps) {
  const { removeBlankAnnotations } = useAnnotationActions();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const systemKeys = new Set(systemAnnotationKeys ?? []);
  const userAnnotations: CategorizedAnnotation[] = [];
  const systemAnnotations: CategorizedAnnotation[] = [];

  let index = 0;
  for (const annotation of annotations) {
    if (systemKeys.has(annotation.key)) {
      systemAnnotations.push({ annotation, index });
    } else {
      userAnnotations.push({ annotation, index });
    }
    index++;
  }

  const handleAddNew = () => {
    removeBlankAnnotations(annotations);
    setEditingIndex(null);
    setIsAddingNew(true);
  };

  const handleStartEdit = (index: number) => {
    removeBlankAnnotations(annotations);
    setIsAddingNew(false);
    setEditingIndex(index);
  };

  const handleStopEdit = () => {
    setEditingIndex(null);
  };

  const handleCloseDraft = () => {
    setIsAddingNew(false);
  };

  const addAction = !readonly ? (
    <Button
      variant="ghost"
      size="xs"
      onClick={handleAddNew}
      disabled={isAddingNew}
    >
      <Icon name="CirclePlus" size="xs" />
      <Text size="xs">New</Text>
    </Button>
  ) : undefined;

  const showEmptyState = userAnnotations.length === 0 && !isAddingNew;

  return (
    <BlockStack gap="3">
      <ContentBlock title="Task annotations" titleAction={addAction}>
        {showEmptyState ? (
          <Text size="xs" tone="subdued">
            No annotations
          </Text>
        ) : (
          <BlockStack>
            {userAnnotations.map(({ annotation, index }) => (
              <AnnotationRow
                key={`annotation-${index}`}
                annotation={annotation}
                index={index}
                annotations={annotations}
                readonly={readonly}
                isEditing={editingIndex === index}
                onStartEdit={() => handleStartEdit(index)}
                onStopEdit={handleStopEdit}
              />
            ))}
            {isAddingNew && (
              <NewAnnotationRow
                annotations={annotations}
                onClose={handleCloseDraft}
              />
            )}
          </BlockStack>
        )}
      </ContentBlock>
      {systemAnnotations.length > 0 && (
        <SystemAnnotationsSection items={systemAnnotations} />
      )}
    </BlockStack>
  );
});

interface AnnotationRowProps {
  annotation: Annotation;
  index: number;
  annotations: Annotations;
  readonly?: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}

function AnnotationRow({
  annotation,
  index,
  annotations,
  readonly,
  isEditing,
  onStartEdit,
  onStopEdit,
}: AnnotationRowProps) {
  const { updateAnnotationKey, updateAnnotationValue, removeAnnotation } =
    useAnnotationActions();
  const containerRef = useRef<HTMLDivElement>(null);
  const [keyDraft, setKeyDraft] = useState(annotation.key);
  const [valueDraft, setValueDraft] = useState(() =>
    formatAnnotationValue(annotation.value),
  );
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    setKeyDraft(annotation.key);
  }, [annotation.key]);

  useEffect(() => {
    setValueDraft(formatAnnotationValue(annotation.value));
  }, [annotation.value]);

  const handleCommitKey = () => {
    const newKey = keyDraft.trim();
    if (newKey === annotation.key) {
      setKeyError(null);
      return;
    }
    if (newKey === "") {
      updateAnnotationKey(annotations, index, newKey);
      setKeyError(null);
      return;
    }
    const collides = annotations.some(
      (a, i) => i !== index && a.key === newKey,
    );
    if (collides) {
      setKeyError("Key already in use");
      setKeyDraft(annotation.key);
      return;
    }
    setKeyError(null);
    updateAnnotationKey(annotations, index, newKey);
  };

  const handleCommitValue = () => {
    const currentValue = formatAnnotationValue(annotation.value);
    if (valueDraft !== currentValue) {
      updateAnnotationValue(annotations, index, valueDraft);
    }
  };

  const handleContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && containerRef.current?.contains(next)) {
      return;
    }
    if (
      annotation.key === "" &&
      formatAnnotationValue(annotation.value) === ""
    ) {
      removeAnnotation(annotations, index);
    }
    onStopEdit();
  };

  const handleRemove = () => {
    removeAnnotation(annotations, index);
    if (isEditing) onStopEdit();
  };

  if (!isEditing) {
    return (
      <InlineStack
        gap="2"
        wrap="nowrap"
        blockAlign="center"
        className="group w-full rounded-xs px-1 py-0.5 hover:bg-gray-50"
      >
        <BlockStack align="stretch" className="flex-1 min-w-0">
          {annotation.key ? (
            <CopyText
              size="xs"
              compact
              className="font-mono! text-muted-foreground truncate"
            >
              {annotation.key}
            </CopyText>
          ) : (
            <Text size="xs" font="mono" tone="subdued">
              (empty key)
            </Text>
          )}
          {formatAnnotationValue(annotation.value) ? (
            <CopyText size="xs" compact className="font-mono! truncate">
              {formatAnnotationValue(annotation.value)}
            </CopyText>
          ) : (
            <Text size="xs" font="mono" tone="subdued">
              (empty value)
            </Text>
          )}
        </BlockStack>
        {!readonly && (
          <InlineStack className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="xs"
              onClick={onStartEdit}
              aria-label="Edit annotation"
            >
              <Icon name="Pencil" size="xs" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleRemove}
              aria-label="Remove annotation"
            >
              <Icon name="Trash" className="text-destructive" />
            </Button>
          </InlineStack>
        )}
      </InlineStack>
    );
  }

  return (
    <div ref={containerRef} onBlur={handleContainerBlur} className="w-full">
      <InlineStack
        gap="1"
        wrap="nowrap"
        className="w-full px-1 py-0.5"
        blockAlign="start"
      >
        <BlockStack gap="1" className="flex-1 min-w-0">
          <Input
            autoFocus
            className={cn(
              "w-full font-mono text-xs!",
              keyError && "border-destructive focus-visible:ring-destructive",
            )}
            placeholder="Key"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onBlur={handleCommitKey}
            aria-invalid={keyError !== null}
          />
          <Input
            className="w-full font-mono text-xs!"
            placeholder="Value"
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
            onBlur={handleCommitValue}
          />
          {keyError && (
            <Text size="xs" tone="critical">
              {keyError}
            </Text>
          )}
        </BlockStack>
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={handleRemove}
          aria-label="Remove annotation"
        >
          <Icon name="Trash" className="text-destructive" />
        </Button>
      </InlineStack>
    </div>
  );
}

interface NewAnnotationRowProps {
  annotations: Annotations;
  onClose: () => void;
}

function NewAnnotationRow({ annotations, onClose }: NewAnnotationRowProps) {
  const { addAnnotation } = useAnnotationActions();
  const containerRef = useRef<HTMLDivElement>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [valueDraft, setValueDraft] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  const validateKey = (key: string): string | null => {
    if (key === "") return null;
    const collides = annotations.some((a) => a.key === key);
    return collides ? "Key already in use" : null;
  };

  const handleKeyBlur = () => {
    setKeyError(validateKey(keyDraft.trim()));
  };

  const handleContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && containerRef.current?.contains(next)) {
      return;
    }
    const key = keyDraft.trim();
    if (key === "" && valueDraft === "") {
      onClose();
      return;
    }
    const error = validateKey(key);
    if (error) {
      setKeyError(error);
      return;
    }
    addAnnotation(annotations, { key, value: valueDraft });
    onClose();
  };

  return (
    <div ref={containerRef} onBlur={handleContainerBlur} className="w-full">
      <InlineStack
        gap="1"
        wrap="nowrap"
        className="w-full px-1 py-0.5"
        blockAlign="start"
      >
        <BlockStack align="stretch" gap="1" className="flex-1 min-w-0">
          <Input
            autoFocus
            className={cn(
              "w-full font-mono text-xs!",
              keyError && "border-destructive focus-visible:ring-destructive",
            )}
            placeholder="Key"
            value={keyDraft}
            onChange={(e) => {
              setKeyDraft(e.target.value);
              if (keyError) setKeyError(null);
            }}
            onBlur={handleKeyBlur}
            aria-invalid={keyError !== null}
          />
          <Input
            className="w-full font-mono text-xs!"
            placeholder="Value"
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
          />
          {keyError && (
            <Text size="xs" tone="critical">
              {keyError}
            </Text>
          )}
        </BlockStack>
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={onClose}
          aria-label="Discard new annotation"
        >
          <Icon name="Trash" className="text-destructive" />
        </Button>
      </InlineStack>
    </div>
  );
}

interface SystemAnnotationsSectionProps {
  items: CategorizedAnnotation[];
}

function SystemAnnotationsSection({ items }: SystemAnnotationsSectionProps) {
  return (
    <ContentBlock title="System annotations" collapsible defaultOpen={false}>
      <BlockStack>
        {items.map(({ annotation, index }) => (
          <BlockStack key={`system-${index}`} className="py-0.5 w-full">
            <CopyText
              size="xs"
              compact
              className="font-mono! text-muted-foreground"
            >
              {annotation.key}
            </CopyText>
            <CopyText size="xs" compact className="font-mono!">
              {formatAnnotationValue(annotation.value)}
            </CopyText>
          </BlockStack>
        ))}
      </BlockStack>
    </ContentBlock>
  );
}
