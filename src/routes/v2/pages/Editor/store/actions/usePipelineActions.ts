import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import {
  createSubgraph,
  renamePipeline,
  updatePipelineDescription,
  updatePipelineNotes,
  updatePipelineTags,
} from "./pipeline.actions";

export function usePipelineActions() {
  const { undo } = useEditorSession();

  return {
    renamePipeline: renamePipeline.bind(null, undo),
    updatePipelineDescription: updatePipelineDescription.bind(null, undo),
    updatePipelineNotes: updatePipelineNotes.bind(null, undo),
    updatePipelineTags: updatePipelineTags.bind(null, undo),
    createSubgraph: createSubgraph.bind(null, undo),
  };
}
