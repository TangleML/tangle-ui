import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import {
  addGuideline,
  cleanupDeletedBinding,
  removeConduit,
  toggleEdgeOnConduit,
  unassignEdgeFromConduit,
  updateConduitColor,
  updateGuidelineCoordinate,
} from "./conduits.actions";

export function useConduitActions() {
  const { undo } = useEditorSession();

  return {
    addGuideline: addGuideline.bind(null, undo),
    removeConduit: removeConduit.bind(null, undo),
    updateGuidelineCoordinate: updateGuidelineCoordinate.bind(null, undo),
    updateConduitColor: updateConduitColor.bind(null, undo),
    unassignEdgeFromConduit: unassignEdgeFromConduit.bind(null, undo),
    toggleEdgeOnConduit: toggleEdgeOnConduit.bind(null, undo),
    cleanupDeletedBinding: cleanupDeletedBinding.bind(null, undo),
  };
}
