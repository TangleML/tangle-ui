import type { EmbedReference } from "@tangent/embed-react";

import { useProjectResourceItems } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
import {
  formatWorkareaTarget,
  runTarget,
} from "@/services/projects/resourceTarget";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";

const newestFirst = (a: Date | null, b: Date | null) =>
  (b?.getTime() ?? 0) - (a?.getTime() ?? 0);

/**
 * The project's pipelines, documents and runs for the chat's `#` picker,
 * newest first, since the picker keeps the order it is given. Each is
 * addressed by its workarea target, which the agent can open with
 * `open_workarea_target` and the transcript shows as a chip. When a project
 * holds two pipelines of one name, the time they were added tells them apart.
 */
export function useChatReferences(projectId: string): EmbedReference[] {
  const { resources, summaries } = useProjectResourceItems(projectId);
  const { data: runs = [] } = useProjectRuns(projectId);
  const addedAt = new Map(
    summaries.map(({ id, createdAt }) => [id, createdAt]),
  );

  const attached = resources
    .flatMap(({ id, name, target }) =>
      target?.type === "pipeline" || target?.type === "document"
        ? [
            {
              kind: target.type,
              name,
              target,
              addedAt: addedAt.get(id) ?? null,
            },
          ]
        : [],
    )
    .sort((a, b) => newestFirst(a.addedAt, b.addedAt));

  return [
    ...attached.map(({ kind, name, target, addedAt }) => ({
      kind,
      label: name,
      href: formatWorkareaTarget(target),
      detail: addedAt ? formatRelativeTime(addedAt) : undefined,
    })),
    ...[...runs]
      .sort((a, b) => newestFirst(a.createdAt, b.createdAt))
      .map((run) => ({
        kind: "run" as const,
        label: run.pipelineName ?? UNNAMED_PIPELINE,
        href: formatWorkareaTarget(runTarget(run.id)),
        detail: run.createdAt ? formatRelativeTime(run.createdAt) : undefined,
      })),
  ];
}
