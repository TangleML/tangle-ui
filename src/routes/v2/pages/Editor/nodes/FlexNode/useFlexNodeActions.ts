import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import {
  addFlexNode,
  removeFlexNode,
  setFlexNodes,
  updateFlexNode,
  updateFlexNodePosition,
  updateFlexNodeProperties,
} from "./flexNode.actions";

export function useFlexNodeActions() {
  const { undo } = useEditorSession();

  return {
    setFlexNodes: setFlexNodes.bind(null, undo),
    updateFlexNode: updateFlexNode.bind(null, undo),
    updateFlexNodeProperties: updateFlexNodeProperties.bind(null, undo),
    addFlexNode: addFlexNode.bind(null, undo),
    removeFlexNode: removeFlexNode.bind(null, undo),
    updateFlexNodePosition: updateFlexNodePosition.bind(null, undo),
  };
}
