import type { EmbedReference } from "@tangent/embed-react";

import { useArchivedProjectItems } from "@/routes/v2/pages/Tangent/hooks/useArchivedProjectItems";
import { useProjectResourceItems } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { projectCardLists } from "@/routes/v2/pages/Tangent/services/projectCardEntries";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";

const ago = (date: Date | null) =>
  date ? formatRelativeTime(date) : undefined;

/**
 * What the project card lists, for the chat's `#` picker: its pipelines and
 * documents, then its runs, each newest first, since the picker keeps the
 * order it is given. Archived items are left out, as they are on the card.
 * Each is addressed by its workarea target, which the agent can open with
 * `open_workarea_target` and the transcript shows as a chip. When a project
 * holds two pipelines of one name, the time they were added tells them apart.
 */
export function useChatReferences(projectId: string): EmbedReference[] {
  const { resources, summaries } = useProjectResourceItems(projectId);
  const { data: projectRuns = [] } = useProjectRuns(projectId);
  const { archived } = useArchivedProjectItems(projectId);
  const lists = projectCardLists({
    items: resources,
    summaries,
    projectRuns,
    archived,
  });

  return [
    ...[...lists.pipelines, ...lists.documents]
      .filter((item) => !item.archived)
      .sort((a, b) => (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0))
      .map(({ target, name, key, addedAt }) => ({
        kind:
          target.type === "pipeline"
            ? ("pipeline" as const)
            : ("document" as const),
        label: name,
        href: key,
        detail: ago(addedAt),
      })),
    ...lists.runs
      .filter((run) => !run.archived)
      .map(({ pipelineName, key, ranAt }) => ({
        kind: "run" as const,
        label: pipelineName,
        href: key,
        detail: ago(ranAt),
      })),
  ];
}
