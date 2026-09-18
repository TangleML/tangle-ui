import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { isBackendStorage } from "@/services/pipelineStorage/storageMode";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { APP_ROUTES, EDITOR_PATH } from "./appRoutes";

export interface EditorTarget {
  to: string;
  params: Record<string, string>;
}

/**
 * What identifies a pipeline is whatever its store identifies it by, and the
 * path carries that and nothing else. Browser storage keys pipelines on their
 * name and holds each name once, so the name is the identity there. A store
 * that hands out its own ids allows two pipelines the same name, so the id is —
 * and being the identity, it cannot go stale when one is renamed.
 */
function editorSegment(ref: PipelineRef): string {
  return isBackendStorage() && ref.fileId ? ref.fileId : ref.name;
}

export function getDefaultEditorTarget(ref: PipelineRef): EditorTarget {
  const segment = editorSegment(ref);

  return isFlagEnabled("v2_editor")
    ? { to: APP_ROUTES.EDITOR_V2_PIPELINE, params: { pipelineName: segment } }
    : { to: APP_ROUTES.PIPELINE_EDITOR, params: { name: segment } };
}

export function getDefaultEditorHref(ref: PipelineRef): string {
  const base = isFlagEnabled("v2_editor") ? APP_ROUTES.EDITOR_V2 : EDITOR_PATH;

  return `${base}/${encodeURIComponent(editorSegment(ref))}`;
}
