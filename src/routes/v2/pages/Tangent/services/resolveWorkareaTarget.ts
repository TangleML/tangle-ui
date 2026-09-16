import type { ResolvedWorkareaView } from "@/routes/v2/pages/Tangent/workarea/types";
import { findById } from "@/services/pipelineStorage/pipelineRegistry";

const PIPELINE_PROTOCOL = "pipeline://";

export interface ResolveWorkareaTargetOptions {
  title?: string;
}

/**
 * Resolves a string target into a concrete workarea view:
 * - `pipeline://<fileId>` opens the local draft editor.
 * - an `http(s)` URL opens the artifact viewer.
 * - anything else is treated as a pipeline name.
 */
export async function resolveWorkareaTarget(
  target: string,
  options: ResolveWorkareaTargetOptions = {},
): Promise<ResolvedWorkareaView> {
  const trimmed = target.trim();
  const { title } = options;

  if (trimmed.startsWith(PIPELINE_PROTOCOL)) {
    const fileId = trimmed.slice(PIPELINE_PROTOCOL.length);
    const entry = await findById(fileId).catch(() => undefined);
    const name = title ?? entry?.storageKey ?? fileId;
    return { kind: "pipeline", title: name, pipelineRef: { name, fileId } };
  }

  if (/^https?:\/\//.test(trimmed)) {
    return { kind: "artifact", title: title ?? trimmed, url: trimmed };
  }

  return {
    kind: "pipeline",
    title: title ?? trimmed,
    pipelineRef: { name: trimmed },
  };
}
