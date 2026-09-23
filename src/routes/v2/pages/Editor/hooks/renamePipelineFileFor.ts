import type { PipelineFileStore } from "@/routes/v2/pages/Editor/store/pipelineFileStore";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";

/**
 * Renames the file the open pipeline is saved as, and answers with the name it
 * actually took. An agent naming a pipeline picks a name without knowing what
 * else this browser holds, so a collision adjusts rather than overwriting the
 * other pipeline — the same rule `create_pipeline` already follows.
 *
 * Everything an agent renames goes through here rather than through the hook
 * the menu bar uses: that one also navigates, which is meaningless for a
 * pipeline open in a workarea tab rather than at a url of its own.
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
