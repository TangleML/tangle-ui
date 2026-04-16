import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import {
  clearProviderAnnotations,
  saveAnnotation,
  setTaskColor,
  toggleCacheDisable,
} from "./taskConfig.actions";

export function useTaskConfigActions() {
  const { undo } = useEditorSession();

  return {
    toggleCacheDisable: toggleCacheDisable.bind(null, undo),
    saveAnnotation: saveAnnotation.bind(null, undo),
    setTaskColor: setTaskColor.bind(null, undo),
    clearProviderAnnotations: clearProviderAnnotations.bind(null, undo),
  };
}
