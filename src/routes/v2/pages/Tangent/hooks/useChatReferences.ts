import type { EmbedReference } from "@tangent/embed-react";

import { useProjectResourceItems } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
import {
  formatWorkareaTarget,
  runTarget,
} from "@/services/projects/resourceTarget";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";

/**
 * The project's pipelines, documents and runs for the chat's `#` picker. Each
 * is addressed by its workarea target, which the agent can open with
 * `open_workarea_target` and the transcript shows as a chip.
 */
export function useChatReferences(projectId: string): EmbedReference[] {
  const { resources } = useProjectResourceItems(projectId);
  const { data: runs = [] } = useProjectRuns(projectId);

  return [
    ...resources.flatMap(({ name, description, target }) =>
      target?.type === "pipeline" || target?.type === "document"
        ? [
            {
              kind: target.type,
              label: name,
              href: formatWorkareaTarget(target),
              detail: description,
            },
          ]
        : [],
    ),
    ...runs.map((run) => ({
      kind: "run" as const,
      label: run.pipelineName ?? UNNAMED_PIPELINE,
      href: formatWorkareaTarget(runTarget(run.id)),
      detail: run.createdAt ? formatRelativeTime(run.createdAt) : undefined,
    })),
  ];
}
