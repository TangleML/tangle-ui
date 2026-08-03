import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { Annotation } from "@/models/componentSpec";
import type { Annotations } from "@/models/componentSpec/annotations";
import { SYSTEM_ANNOTATIONS } from "@/utils/annotations";

interface TaskAnnotationSection {
  title: string;
  component: ReactNode;
  isCollapsed?: boolean;
}

function formatAnnotationValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Builds annotation sections shaped for `TaskDetails`'s `additionalSection` prop
 * so they render inside the shared details card (matching legacy layout) rather
 * than as a detached block. User and system annotations are kept separate.
 */
export function getTaskAnnotationSections(
  annotations: Annotations,
): TaskAnnotationSection[] {
  const systemKeys = new Set<string>(SYSTEM_ANNOTATIONS);
  const userAnnotations: Annotation[] = [];
  const systemAnnotations: Annotation[] = [];

  for (const annotation of annotations) {
    if (systemKeys.has(annotation.key)) {
      systemAnnotations.push(annotation);
    } else {
      userAnnotations.push(annotation);
    }
  }

  const sections: TaskAnnotationSection[] = [];

  if (userAnnotations.length > 0) {
    sections.push({
      title: "Task Annotations",
      component: <AnnotationList annotations={userAnnotations} />,
    });
  }

  if (systemAnnotations.length > 0) {
    sections.push({
      title: "System annotations",
      component: <AnnotationList annotations={systemAnnotations} />,
      isCollapsed: true,
    });
  }

  return sections;
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

function AnnotationList({ annotations }: AnnotationListProps) {
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
