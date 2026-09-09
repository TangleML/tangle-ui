import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { isHostStorage } from "@/services/pipelineStorage/storageMode";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { APP_ROUTES, EDITOR_PATH } from "./appRoutes";

interface EditorSearch {
  fileId?: string;
}

export interface EditorTarget {
  to: string;
  params: Record<string, string>;
  search: EditorSearch;
}

/**
 * What identifies a pipeline depends on the store. Where the store hands out
 * its own ids, the path carries one and nothing else is needed — names are not
 * unique there, and an id in the path cannot go stale when the pipeline is
 * renamed. Where names are the identity, the path keeps the name and the id
 * rides along to settle the cases a name cannot.
 */
function editorLocation(ref: PipelineRef): {
  segment: string;
  search: EditorSearch;
} {
  if (isHostStorage() && ref.fileId) {
    return { segment: ref.fileId, search: {} };
  }

  return {
    segment: ref.name,
    search: ref.fileId ? { fileId: ref.fileId } : {},
  };
}

export function getDefaultEditorTarget(ref: PipelineRef): EditorTarget {
  const { segment, search } = editorLocation(ref);

  return isFlagEnabled("v2_editor")
    ? {
        to: APP_ROUTES.EDITOR_V2_PIPELINE,
        params: { pipelineName: segment },
        search,
      }
    : { to: APP_ROUTES.PIPELINE_EDITOR, params: { name: segment }, search };
}

export function getDefaultEditorHref(ref: PipelineRef): string {
  const { segment, search } = editorLocation(ref);
  const base = isFlagEnabled("v2_editor") ? APP_ROUTES.EDITOR_V2 : EDITOR_PATH;
  const path = `${base}/${encodeURIComponent(segment)}`;

  return search.fileId
    ? `${path}?fileId=${encodeURIComponent(search.fileId)}`
    : path;
}
