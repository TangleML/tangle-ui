import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import {
  quickConnect,
  removeArgument,
  resetArgumentToDefault,
  setArgument,
  setDynamicData,
  unsetArgument,
} from "./arguments.actions";

export function useArgumentActions() {
  const { undo } = useEditorSession();

  return {
    setArgument: setArgument.bind(null, undo),
    unsetArgument: unsetArgument.bind(null, undo),
    removeArgument: removeArgument.bind(null, undo),
    resetArgumentToDefault: resetArgumentToDefault.bind(null, undo),
    setDynamicData: setDynamicData.bind(null, undo),
    quickConnect: quickConnect.bind(null, undo),
  };
}
