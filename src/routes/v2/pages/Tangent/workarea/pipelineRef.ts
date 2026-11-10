import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";
import {
  parseIdentity,
  type WorkareaTarget,
} from "@/services/projects/resourceTarget";

/**
 * The pipeline a workarea target points at, the way the editor and pipeline
 * storage address it. A draft is looked up on the backend it was made on, and
 * throws when that draft is gone.
 */
export function pipelineRefForTarget(
  target: WorkareaTarget,
  title: string,
  {
    backendUrl,
    storage,
  }: { backendUrl: string; storage: PipelineStorageService },
): EditorPipelineRef {
  const { key, value } = parseIdentity(target.identity);
  if (key === "remote") {
    return { source: "remote", backendUrl, pipelineId: value };
  }
  if (key === "draft") return storage.getRemoteDraftRef(value, backendUrl);
  if (key === "id") return { fileId: value, name: title };
  return { name: value };
}
