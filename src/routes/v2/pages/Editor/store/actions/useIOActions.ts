import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import {
  addInput,
  addOutput,
  createConnectedIONode,
  createInputAndConnect,
  deleteInput,
  deleteOutput,
  renameInput,
  renameOutput,
  setInputDefaultValue,
  setInputDescription,
  setInputType,
  setOutputDescription,
} from "./io.actions";

export function useIOActions() {
  const { undo } = useEditorSession();
  const { navigation } = useSharedStores();

  return {
    addInput: addInput.bind(null, undo),
    addOutput: addOutput.bind(null, undo),
    renameInput: (spec: ComponentSpec, entityId: string, newName: string) =>
      renameInput(undo, spec, entityId, newName, navigation.parentContext),
    renameOutput: (spec: ComponentSpec, entityId: string, newName: string) =>
      renameOutput(undo, spec, entityId, newName, navigation.parentContext),
    deleteInput: (spec: ComponentSpec, entityId: string) =>
      deleteInput(undo, spec, entityId, navigation.parentContext),
    deleteOutput: (spec: ComponentSpec, entityId: string) =>
      deleteOutput(undo, spec, entityId, navigation.parentContext),
    setInputDescription: setInputDescription.bind(null, undo),
    setInputType: setInputType.bind(null, undo),
    setInputDefaultValue: setInputDefaultValue.bind(null, undo),
    setOutputDescription: setOutputDescription.bind(null, undo),
    createConnectedIONode: createConnectedIONode.bind(null, undo),
    createInputAndConnect: createInputAndConnect.bind(null, undo),
  };
}
