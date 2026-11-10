import type { ProjectResourceItem } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
import {
  formatWorkareaTarget,
  parseIdentity,
  runTarget,
  type WorkareaTarget,
} from "@/services/projects/resourceTarget";
import type {
  ProjectResourceSummary,
  ProjectRun,
} from "@/services/projects/types";

export interface RunEntry {
  id: string;
  pipelineName: string;
  ranAt: Date | null;
}

export interface ProjectCardRun extends RunEntry {
  key: string;
  archived: boolean;
}

export interface ProjectCardItem extends ProjectResourceItem {
  key: string;
  target: WorkareaTarget;
  addedAt: Date | null;
  archived: boolean;
}

export interface ProjectCardLists {
  runs: ProjectCardRun[];
  pipelines: ProjectCardItem[];
  documents: ProjectCardItem[];
}

const newestFirst = (a: Date | null, b: Date | null) =>
  (b?.getTime() ?? 0) - (a?.getTime() ?? 0);

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
  return [...entries.values()].sort((a, b) => newestFirst(a.ranAt, b.ranAt));
}

/**
 * What the project card lists: its runs, pipelines and documents, each newest
 * first and keyed by workarea target, which is also how archiving marks them.
 * The card, the chat's `#` picker, the agent and the slash commands all read
 * this, so they list the same things.
 */
export function projectCardLists({
  items,
  summaries,
  projectRuns,
  archived,
}: {
  items: ProjectResourceItem[];
  summaries: ProjectResourceSummary[];
  projectRuns: ProjectRun[];
  archived: ReadonlySet<string>;
}): ProjectCardLists {
  const addedAt = new Map(
    summaries.map(({ id, createdAt }) => [id, createdAt]),
  );
  const attached = items
    .flatMap((item) => {
      if (!item.target) return [];
      const key = formatWorkareaTarget(item.target);
      return [
        {
          ...item,
          key,
          target: item.target,
          addedAt: addedAt.get(item.id) ?? null,
          archived: archived.has(key),
        },
      ];
    })
    .sort((a, b) => newestFirst(a.addedAt, b.addedAt));
  const ofType = (type: WorkareaTarget["type"]) =>
    attached.filter(({ target }) => target.type === type);

  const runs = mergeProjectRuns(
    projectRuns,
    ofType("run").map(({ name, target, addedAt }) => ({
      id: parseIdentity(target.identity).value,
      pipelineName: name,
      ranAt: addedAt,
    })),
  ).map((run) => {
    const key = formatWorkareaTarget(runTarget(run.id));
    return { ...run, key, archived: archived.has(key) };
  });

  return { runs, pipelines: ofType("pipeline"), documents: ofType("document") };
}
