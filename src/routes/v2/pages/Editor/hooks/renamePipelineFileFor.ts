import type { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import type { PipelineFileStore } from "@/routes/v2/pages/Editor/store/pipelineFileStore";

export function renamePipelineFileFor(
  autoSave: AutoSaveStore,
  pipelineFile: PipelineFileStore,
  onRenamed?: (fileId: string, name: string) => void,
  assertCurrentDocument?: () => void,
) {
  return async (name: string): Promise<void> => {
    assertCurrentDocument?.();
    const file = pipelineFile.activePipelineFile;
    await autoSave.save();
    assertCurrentDocument?.();
    if (file && pipelineFile.activePipelineFile === file)
      onRenamed?.(file.id, name);
  };
}
