import type { PipelineFileStore } from "@/routes/v2/pages/Editor/store/pipelineFileStore";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";

/**
 * Answers with the name the file actually took: an agent picks one without
 * knowing what else this browser holds, so a collision adjusts rather than
 * overwriting, as `create_pipeline` already does.
 *
 * Agent renames come here rather than through the hook the menu bar uses, which
 * also navigates — meaningless for a pipeline open in a workarea tab.
 */
export function renamePipelineFileFor(
  pipelineFile: PipelineFileStore,
  onRenamed?: (fileId: string, name: string) => void,
) {
  return async (name: string): Promise<string> => {
    const file = pipelineFile.activePipelineFile;
    if (!file) return name;
    if (file.storageKey === name) return name;

    const available = await availablePipelineName(name);
    await file.rename(available);
    onRenamed?.(file.id, available);
    return available;
  };
}
