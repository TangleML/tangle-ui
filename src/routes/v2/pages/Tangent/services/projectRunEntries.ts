import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
import type { ProjectRun } from "@/services/projects/types";

export interface RunEntry {
  id: string;
  pipelineName: string;
  ranAt: Date | null;
}

/**
 * The runs started in the project and the runs attached to it, newest first.
 * A run attached on its own is named after its pipeline. A run that is both
 * is listed once.
 */
export function mergeProjectRuns(
  runs: ProjectRun[],
  attachedRuns: RunEntry[],
): RunEntry[] {
  const entries = new Map<string, RunEntry>();
  for (const run of runs) {
    entries.set(run.id, {
      id: run.id,
      pipelineName: run.pipelineName ?? UNNAMED_PIPELINE,
      ranAt: run.createdAt,
    });
  }
  for (const entry of attachedRuns) {
    if (!entries.has(entry.id)) entries.set(entry.id, entry);
  }
  return [...entries.values()].sort(
    (a, b) => (b.ranAt?.getTime() ?? 0) - (a.ranAt?.getTime() ?? 0),
  );
}
