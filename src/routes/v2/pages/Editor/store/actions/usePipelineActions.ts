import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import {
  createSubgraph,
  renamePipeline,
  renameSubgraph,
  updatePipelineDescription,
  updatePipelineNotes,
} from "./pipeline.actions";

export function usePipelineActions() {
  const { undo } = useEditorSession();
  const { navigation } = useSharedStores();

  return {
    renamePipeline: renamePipeline.bind(null, undo),
    renameSubgraph: renameSubgraph.bind(null, undo, navigation),
    updatePipelineDescription: updatePipelineDescription.bind(null, undo),
    updatePipelineNotes: updatePipelineNotes.bind(null, undo),
    createSubgraph: createSubgraph.bind(null, undo),
  };
}
