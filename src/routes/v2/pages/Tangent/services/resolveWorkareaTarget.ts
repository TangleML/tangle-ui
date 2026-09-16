import type { ResolvedWorkareaView } from "@/routes/v2/pages/Tangent/workarea/types";
import { findById } from "@/services/pipelineStorage/pipelineRegistry";

const PIPELINE_PROTOCOL = "pipeline://";
const RUN_PROTOCOL = "run:";

export interface ResolveWorkareaTargetOptions {
  title?: string;
}

/**
 * Extracts a run id from a `run:<id>` target or a run URL. Matches both the v1
 * (`/runs/<id>`) and v2 (`/runs-v2/<id>`) route shapes, with or without a
 * trailing subgraph-execution segment. Returns `null` when the target is not a
 * run.
 */
function extractRunId(target: string): string | null {
  if (target.startsWith(RUN_PROTOCOL)) {
    const id = target.slice(RUN_PROTOCOL.length).trim();
    return id.length > 0 ? id : null;
  }
  const match = target.match(/\/runs(?:-v2)?\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolves a string target into a concrete workarea view:
 * - `pipeline://<fileId>` opens the local draft editor.
 * - a run URL or `run:<id>` opens the run's canvas to inspect its execution.
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

  const runId = extractRunId(trimmed);
  if (runId) {
    return { kind: "run", title: title ?? `Run ${runId}`, runId };
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
