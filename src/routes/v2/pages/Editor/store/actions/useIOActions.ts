import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

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

  return {
    addInput: addInput.bind(null, undo),
    addOutput: addOutput.bind(null, undo),
    deleteInput: deleteInput.bind(null, undo),
    deleteOutput: deleteOutput.bind(null, undo),
    renameInput: renameInput.bind(null, undo),
    renameOutput: renameOutput.bind(null, undo),
    setInputDescription: setInputDescription.bind(null, undo),
    setInputType: setInputType.bind(null, undo),
    setInputDefaultValue: setInputDefaultValue.bind(null, undo),
    setOutputDescription: setOutputDescription.bind(null, undo),
    createConnectedIONode: createConnectedIONode.bind(null, undo),
    createInputAndConnect: createInputAndConnect.bind(null, undo),
  };
}
