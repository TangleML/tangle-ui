import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import {
  addAnnotation,
  removeAnnotation,
  removeBlankAnnotations,
  updateAnnotationKey,
  updateAnnotationValue,
} from "./annotations.actions";

export function useAnnotationActions() {
  const { undo } = useEditorSession();

  return {
    addAnnotation: addAnnotation.bind(null, undo),
    updateAnnotationKey: updateAnnotationKey.bind(null, undo),
    updateAnnotationValue: updateAnnotationValue.bind(null, undo),
    removeAnnotation: removeAnnotation.bind(null, undo),
    removeBlankAnnotations: removeBlankAnnotations.bind(null, undo),
  };
}
