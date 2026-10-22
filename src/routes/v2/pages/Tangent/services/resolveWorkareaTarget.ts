import { RUNS_BASE_PATH } from "@/routes/appRoutes";
import { getWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type {
  ResolvedWorkareaView,
  WorkareaTarget,
} from "@/routes/v2/pages/Tangent/workarea/types";
import {
  idIdentity,
  isWorkareaTargetString,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";

export interface ResolveWorkareaTargetOptions {
  title?: string;
}

const RUN_PATH_SEGMENT = RUNS_BASE_PATH.slice(1);

function runIdFromUrl(raw: string): string | undefined {
  let path: string;
  try {
    path = new URL(raw, "http://app.invalid").pathname;
  } catch {
    return undefined;
  }

  const segments = path.split("/").filter((segment) => segment !== "");
  const runsAt = segments.findIndex((segment) => segment === RUN_PATH_SEGMENT);
  const id = runsAt === -1 ? undefined : segments[runsAt + 1];
  return id ? decodeURIComponent(id) : undefined;
}

/**
 * Agents hand over whatever they have, and a run url they built against another
 * environment's origin still names a run this one can open.
 */
export function coerceWorkareaTarget(raw: string): WorkareaTarget {
  if (isWorkareaTargetString(raw)) return parseWorkareaTarget(raw);

  const runId = runIdFromUrl(raw);
  if (runId) return { type: "run", identity: idIdentity(runId) };

  return parseWorkareaTarget(raw);
}

/**
 * Resolves a caller-constructed `WorkareaTarget` into a view ready to become a
 * tab. Each kind owns title resolution; the target is passed through.
 */
export async function resolveWorkareaTarget(
  target: WorkareaTarget,
  options: ResolveWorkareaTargetOptions = {},
): Promise<ResolvedWorkareaView> {
  const kind = getWorkareaKind(target.type);
  if (!kind) {
    throw new Error(`Unsupported workarea target type: ${target.type}`);
  }
  const title = options.title ?? (await kind.resolveTitle(target));
  return { title, target };
}
