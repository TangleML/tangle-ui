import { observer } from "mobx-react-lite";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useOpenWorkareaTarget } from "@/routes/v2/pages/Tangent/hooks/useOpenWorkareaTarget";
import { useProjectResourceItems } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
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
      icon: "Play" as const,
      title: run.pipelineName ?? UNNAMED_PIPELINE,
      meta: run.createdAt ? formatRelativeTime(run.createdAt) : "Run",
      target: { type: "run" as const, identity: idIdentity(run.id) },
    })),
  ];

  const open = ({ target, title }: Suggestion) => openTarget(target, title);

  return (
    <BlockStack
      gap="6"
      align="center"
      className="min-h-0 flex-1 justify-center p-6"
    >
      <BlockStack gap="2" align="center" className="text-center">
        <Icon
          name="LayoutTemplate"
          size="lg"
          className="text-muted-foreground"
        />
        <Text size="sm" weight="semibold">
          Nothing open yet
        </Text>
        <Text size="sm" tone="subdued">
          Tangent will open artifacts here as you work.
        </Text>
      </BlockStack>

      {suggestions.length > 0 && (
        <BlockStack gap="2" align="stretch" className="w-full max-w-sm">
          <Text size="xs" weight="medium" tone="subdued" className="px-1">
            Jump back in
          </Text>
          <ul
            aria-label="Jump back in"
            className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-background/40"
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => void open(suggestion)}
                  className="group flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left outline-none transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset motion-reduce:transition-none"
                  {...tracking("projects.canvas.open_suggestion", {
                    kind: suggestion.target.type,
                  })}
                >
                  <Icon
                    name={suggestion.icon}
                    size="sm"
                    className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  />
                  <Text size="sm" className="min-w-0 flex-1 truncate">
                    {suggestion.title}
                  </Text>
                  <Text size="xs" tone="subdued" className="shrink-0">
                    {suggestion.meta}
                  </Text>
                </button>
              </li>
            ))}
          </ul>
        </BlockStack>
      )}
    </BlockStack>
  );
});
