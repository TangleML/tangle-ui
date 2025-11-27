import { PlusCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { AnnotationConfig, Annotations } from "@/types/annotations";

import { AnnotationsInput } from "./AnnotationsInput";
import {
  NewAnnotationRow,
  type NewAnnotationRowData,
} from "./NewAnnotationRow";

const DEFAULT_COMMON_ANNOTATIONS: AnnotationConfig[] = [
  {
    annotation: "editor.position",
    label: "Node position",
    type: "json",
  },
];

interface AnnotationsEditorProps {
  annotations: Annotations;
  pinnedAnnotations?: AnnotationConfig[];
  onSave: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  newRows: Array<NewAnnotationRowData>;
  onNewRowBlur: (newRow: NewAnnotationRowData) => void;
  onRemoveNewRow: (newRow: NewAnnotationRowData) => void;
  onAddNewRow: () => void;
}

export const AnnotationsEditor = ({
  annotations,
  pinnedAnnotations = DEFAULT_COMMON_ANNOTATIONS,
  onSave,
  onRemove,
  newRows,
  onNewRowBlur,
  onRemoveNewRow,
  onAddNewRow,
}: AnnotationsEditorProps) => {
  const remainingAnnotations = Object.entries(annotations).filter(
    ([key]) => !pinnedAnnotations.some((config) => config.annotation === key),
  );

  return (
    <BlockStack gap="2">
      <InlineStack
        gap="2"
        align="space-between"
        blockAlign="center"
        className="w-full"
      >
        <Heading level={1}>Annotations</Heading>

        <Button
          onClick={onAddNewRow}
          variant="ghost"
          className="w-fit"
          type="button"
        >
          <PlusCircleIcon className="h-4 w-4" />
          New
        </Button>
      </InlineStack>

      {pinnedAnnotations.map((config) => (
        <BlockStack key={config.annotation}>
          <Paragraph size="xs" tone="subdued">
            {config.label} {config.unit && `(${config.unit})`}
          </Paragraph>

          <AnnotationsInput
            key={config.annotation}
            value={annotations[config.annotation]}
            onBlur={(newValue) => onSave(config.annotation, newValue)}
            annotations={annotations}
            config={config}
          />
        </BlockStack>
      ))}

      {remainingAnnotations.map(([key, value]) => (
        <BlockStack key={key}>
          <Paragraph size="xs" tone="subdued">
            {key}
          </Paragraph>

          <AnnotationsInput
            key={key}
            value={value}
            onBlur={(newValue) => onSave(key, newValue)}
            onDelete={() => onRemove(key)}
            annotations={annotations}
            deletable
          />
        </BlockStack>
      ))}

      {newRows.map((row, idx) => (
        <NewAnnotationRow
          key={row.id}
          row={row}
          autofocus={idx === newRows.length - 1}
          onBlur={onNewRowBlur}
          onRemove={onRemoveNewRow}
        />
      ))}
    </BlockStack>
  );
};
