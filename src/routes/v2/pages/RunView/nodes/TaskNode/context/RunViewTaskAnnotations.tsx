import type { ReactNode } from "react";

import { AnnotationList } from "@/components/shared/ContextPanel/Blocks/AnnotationList";
import type { Annotation } from "@/models/componentSpec";
import type { Annotations } from "@/models/componentSpec/annotations";
import { SYSTEM_ANNOTATIONS } from "@/utils/annotations";

interface TaskAnnotationSection {
  title: string;
  component: ReactNode;
  isCollapsed?: boolean;
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
