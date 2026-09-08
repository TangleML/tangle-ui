import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
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
 * A pipeline's identity travels in the search params, not the path: the slug is
 * only ever a display name, and two pipelines are allowed to share one.
 */
export function getDefaultEditorTarget(ref: PipelineRef): EditorTarget {
  const search: EditorSearch = ref.fileId ? { fileId: ref.fileId } : {};

  return isFlagEnabled("v2_editor")
    ? {
        to: APP_ROUTES.EDITOR_V2_PIPELINE,
        params: { pipelineName: ref.name },
        search,
      }
    : { to: APP_ROUTES.PIPELINE_EDITOR, params: { name: ref.name }, search };
}

export function getDefaultEditorHref(ref: PipelineRef): string {
  const base = isFlagEnabled("v2_editor") ? APP_ROUTES.EDITOR_V2 : EDITOR_PATH;
  const path = `${base}/${encodeURIComponent(ref.name)}`;

  return ref.fileId ? `${path}?fileId=${encodeURIComponent(ref.fileId)}` : path;
}
