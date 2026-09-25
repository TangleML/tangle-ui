import { observer } from "mobx-react-lite";

import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { Annotation } from "@/models/componentSpec";

function formatAnnotationValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface AnnotationRowProps {
  annotation: Annotation;
}

const AnnotationRow = observer(function AnnotationRow({
  annotation,
}: AnnotationRowProps) {
  const value = formatAnnotationValue(annotation.value);

  return (
    <BlockStack align="stretch" className="min-w-0 w-full">
      {annotation.key ? (
        <CopyText
          size="xs"
          compact
          tone="subdued"
          font="mono"
          className="truncate"
        >
          {annotation.key}
        </CopyText>
      ) : (
        <Text size="xs" font="mono" tone="subdued">
          (empty key)
        </Text>
      )}
      {value ? (
        <CopyText size="xs" compact font="mono" className="truncate">
          {value}
        </CopyText>
      ) : (
        <Text size="xs" font="mono" tone="subdued">
          (empty value)
        </Text>
      )}
    </BlockStack>
  );
});

interface AnnotationListProps {
  annotations: Annotation[];
}

export function AnnotationList({ annotations }: AnnotationListProps) {
  return (
    <BlockStack gap="1">
      {annotations.map((annotation, index) => (
        <AnnotationRow
          key={`${annotation.key}-${index}`}
          annotation={annotation}
        />
      ))}
    </BlockStack>
  );
}
