import type { Annotation } from "@/models/componentSpec";
import type { Annotations } from "@/models/componentSpec/annotations";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

export function addAnnotation(
  undo: UndoGroupable,
  annotations: Annotations,
  annotation: Annotation = { key: "", value: "" },
) {
  undo.withGroup("Add annotation", () => {
    annotations.add(annotation);
  });
}

export function updateAnnotationKey(
  undo: UndoGroupable,
  annotations: Annotations,
  index: number,
  key: string,
) {
  undo.withGroup("Update annotation key", () => {
    annotations.updateAt(index, { key });
  });
}

export function updateAnnotationValue(
  undo: UndoGroupable,
  annotations: Annotations,
  index: number,
  value: string,
) {
  undo.withGroup("Update annotation value", () => {
    annotations.updateAt(index, { value });
  });
}

export function removeAnnotation(
  undo: UndoGroupable,
  annotations: Annotations,
  index: number,
) {
  undo.withGroup("Remove annotation", () => {
    annotations.removeAt(index);
  });
}

export function removeBlankAnnotations(
  undo: UndoGroupable,
  annotations: Annotations,
) {
  const hasBlanks = annotations.some(
    (a) => a.key === "" && String(a.value ?? "") === "",
  );
  if (!hasBlanks) return;
  undo.withGroup("Remove blank annotations", () => {
    annotations.removeBlanks();
  });
}
