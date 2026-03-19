import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import {
  createSubgraph,
  renamePipeline,
  updatePipelineDescription,
} from "./pipeline.actions";

export function usePipelineActions() {
  const { undo } = useEditorSession();

  return {
    renamePipeline: renamePipeline.bind(null, undo),
    updatePipelineDescription: updatePipelineDescription.bind(null, undo),
    createSubgraph: createSubgraph.bind(null, undo),
  };
}
