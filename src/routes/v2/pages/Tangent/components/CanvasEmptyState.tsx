import { observer } from "mobx-react-lite";

import { EmptyState } from "@/components/ui/empty-state";
import type { IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/list-item";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useOpenWorkareaTarget } from "@/routes/v2/pages/Tangent/hooks/useOpenWorkareaTarget";
import { useProjectResourceItems } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
import { resourceMeta } from "@/services/projects/resourceMeta";
import {
  idIdentity,
  type WorkareaTarget,
} from "@/services/projects/resourceTarget";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

const RESOURCE_LIMIT = 4;
const RUN_LIMIT = 3;

interface Suggestion {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  target: WorkareaTarget;
}

/**
 * An empty canvas offers a few of the project's things to open, quietly, so the
 * space is a starting point rather than a dead end.
 */
export const CanvasEmptyState = observer(function CanvasEmptyState() {
  const store = useTangentProject();
  const openTarget = useOpenWorkareaTarget();
  const { resources } = useProjectResourceItems(store.projectId);
  const { data: runs = [] } = useProjectRuns(store.projectId);

  const suggestions: Suggestion[] = [
    ...resources
      .flatMap(({ id, icon, name, description, target }) =>
        target ? [{ id, icon, title: name, meta: description, target }] : [],
      )
      .slice(0, RESOURCE_LIMIT),
    ...runs.slice(0, RUN_LIMIT).map((run) => ({
      id: run.id,
      icon: resourceMeta("run").icon,
      title: run.pipelineName ?? UNNAMED_PIPELINE,
      meta: run.createdAt ? formatRelativeTime(run.createdAt) : "Run",
      target: { type: "run" as const, identity: idIdentity(run.id) },
    })),
  ];

  const open = ({ target, title }: Suggestion) => openTarget(target, title);

  return (
    <EmptyState
      icon="LayoutTemplate"
      title="Nothing open yet"
      description="Tangent will open artifacts here as you work."
      className="min-h-0 flex-1"
    >
      {suggestions.length > 0 && (
        <BlockStack gap="2" align="stretch" className="mx-auto max-w-sm">
          <Text size="xs" weight="medium" tone="subdued" className="px-2">
            Jump back in
          </Text>
          <BlockStack
            as="ul"
            align="stretch"
            aria-label="Jump back in"
            className="rounded-lg border border-border/70 bg-background/40 p-1"
          >
            {suggestions.map((suggestion) => (
              <ListItem
                key={suggestion.id}
                icon={suggestion.icon}
                title={suggestion.title}
                subtitle={suggestion.meta}
                onOpen={() => void open(suggestion)}
                tracking={tracking("projects.canvas.open_suggestion", {
                  kind: suggestion.target.type,
                })}
              />
            ))}
          </BlockStack>
        </BlockStack>
      )}
    </EmptyState>
  );
});
