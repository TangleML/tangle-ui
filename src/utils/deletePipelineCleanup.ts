import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { deletePipeline } from "@/services/pipelineService";

const KEY_PREFIX = "tangle:deletePipeline:";

export const markPipelineForDeletion = (name: string) => {
  localStorage.setItem(KEY_PREFIX + name, "1");
};

// Deletes pipelines marked during a previous page load (from Editor's beforeunload handler).
// Skips any pipeline whose editor URL matches the current URL — that means the user refreshed.
export const processPendingDeletions = async () => {
  if (!isFlagEnabled("auto-delete-empty-pipelines")) return;

  const currentPath = window.location.pathname + window.location.hash;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    const name = key.slice(KEY_PREFIX.length);
    const editorPath = `/editor/${encodeURIComponent(name)}`;
    if (currentPath === editorPath || currentPath.endsWith(`#${editorPath}`)) {
      // User refreshed or navigated back — clear the mark but keep the pipeline.
      localStorage.removeItem(key);
      continue;
    }
    localStorage.removeItem(key);
    await deletePipeline(name);
  }
};
