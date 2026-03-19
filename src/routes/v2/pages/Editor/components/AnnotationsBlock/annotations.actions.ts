import type { Annotations } from "@/models/componentSpec/annotations";
import { withUndoGroup } from "@/routes/v2/pages/Editor/store/undoStore";

export function addAnnotation(annotations: Annotations) {
  withUndoGroup("Add annotation", () => {
    annotations.add({ key: "", value: "" });
  });
}

export function updateAnnotationKey(
  annotations: Annotations,
  index: number,
  key: string,
) {
  withUndoGroup("Update annotation key", () => {
    annotations.updateAt(index, { key });
  });
}

export function updateAnnotationValue(
  annotations: Annotations,
  index: number,
  value: string,
) {
  withUndoGroup("Update annotation value", () => {
    annotations.updateAt(index, { value });
  });
}

export function removeAnnotation(annotations: Annotations, index: number) {
  withUndoGroup("Remove annotation", () => {
    annotations.removeAt(index);
  });
}
