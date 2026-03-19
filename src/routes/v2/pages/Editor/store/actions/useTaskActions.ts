import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import {
  addTask,
  applyAutoLayoutPositions,
  batchSetTaskColor,
  copySelectedNodes,
  deleteSelectedNodes,
  deleteTask,
  duplicateSelectedNodes,
  pasteNodes,
  renameTask,
} from "./task.actions";

export function useTaskActions() {
  const { undo, clipboard } = useEditorSession();
  const { editor } = useSharedStores();

  return {
    addTask: addTask.bind(null, undo),
    deleteTask: deleteTask.bind(null, undo),
    renameTask: renameTask.bind(null, undo),
    duplicateSelectedNodes: duplicateSelectedNodes.bind(null, clipboard),
    copySelectedNodes: copySelectedNodes.bind(null, clipboard),
    pasteNodes: pasteNodes.bind(null, clipboard),
    deleteSelectedNodes: (
      spec: ComponentSpec,
      selectedNodes: SelectedNode[],
    ) => {
      deleteSelectedNodes(undo, spec, selectedNodes);
      editor.clearSelection();
      editor.clearMultiSelection();
    },
    batchSetTaskColor: batchSetTaskColor.bind(null, undo),
    applyAutoLayoutPositions: applyAutoLayoutPositions.bind(null, undo),
  };
}
