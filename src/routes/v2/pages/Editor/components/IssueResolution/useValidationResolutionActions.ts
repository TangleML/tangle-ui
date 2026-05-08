import type { ComponentSpec, Task } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import {
  deleteDuplicate,
  deleteEntity,
  renameDuplicate,
  renameEntity,
  unsetBadReference,
} from "./validationResolution.actions";

/**
 * Each resolution action automatically clears the selected validation issue
 * after performing its operation, so components don't need to manage that.
 */
export function useValidationResolutionActions() {
  const { undo } = useEditorSession();
  const { editor } = useSharedStores();

  const clearIssue = () => editor.setSelectedValidationIssue(null);

  return {
    deleteEntity: (
      spec: ComponentSpec,
      entityType: "task" | "input" | "output" | "binding",
      entityId: string,
    ) => {
      deleteEntity(undo, spec, entityType, entityId);
      clearIssue();
    },
    renameEntity: (
      spec: ComponentSpec,
      entityType: "task" | "input" | "output" | "component",
      entityId: string | undefined,
      name: string,
    ) => {
      renameEntity(undo, spec, entityType, entityId, name);
      clearIssue();
    },
    renameDuplicate: (
      spec: ComponentSpec,
      entityType: "input" | "output",
      entityId: string,
      name: string,
    ) => {
      renameDuplicate(undo, spec, entityType, entityId, name);
      clearIssue();
    },
    deleteDuplicate: (
      spec: ComponentSpec,
      entityType: "input" | "output",
      entityId: string,
    ) => {
      deleteDuplicate(undo, spec, entityType, entityId);
      clearIssue();
    },
    unsetBadReference: (
      task: Task,
      spec: ComponentSpec,
      argumentName: string,
    ) => {
      unsetBadReference(undo, task, spec, argumentName);
      clearIssue();
    },
  };
}
