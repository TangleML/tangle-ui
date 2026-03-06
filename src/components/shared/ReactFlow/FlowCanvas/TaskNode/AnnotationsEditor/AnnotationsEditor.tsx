import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import {
  DEFAULT_COMMON_ANNOTATIONS,
  getAnnotationValue,
} from "@/utils/annotations";

import { AnnotationsInput } from "./AnnotationsInput";
import {
  NewAnnotationRow,
  type NewAnnotationRowData,
} from "./NewAnnotationRow";

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
      <InlineStack gap="2" align="space-between" className="w-full">
        <Heading level={1}>Annotations</Heading>

        <Button
          onClick={onAddNewRow}
          variant="ghost"
          className="w-fit"
          type="button"
        >
          <Icon name="CirclePlus" />
          New
        </Button>
      </InlineStack>

      {pinnedAnnotations.map((config) => (
        <BlockStack key={config.annotation}>
          <InlineStack>
            <Paragraph size="xs" tone="subdued">
              {config.label} {config.unit && `(${config.unit})`}
            </Paragraph>
            {config.required && (
              <Paragraph size="xs" tone="critical">
                *
              </Paragraph>
            )}
          </InlineStack>

          <AnnotationsInput
            key={config.annotation}
            value={getAnnotationValue(annotations, config.annotation, "")}
            onBlur={(newValue) => onSave(config.annotation, newValue)}
            annotations={annotations}
            config={config}
          />
        </BlockStack>
      ))}

      {remainingAnnotations.map(([key]) => (
        <BlockStack key={key}>
          <Paragraph size="xs" tone="subdued">
            {key}
          </Paragraph>

          <AnnotationsInput
            key={key}
            value={getAnnotationValue(annotations, key, "")}
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
