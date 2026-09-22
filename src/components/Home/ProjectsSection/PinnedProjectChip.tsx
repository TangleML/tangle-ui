import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

import { formatResourceCounts } from "./formatResourceCounts";
import { useProjectPin } from "./useProjectPin";

interface PinnedProjectChipProps {
  project: ProjectSummary;
}

export function PinnedProjectChip({ project }: PinnedProjectChipProps) {
  const { togglePin } = useProjectPin(project);

  return (
    <InlineStack
      blockAlign="center"
      wrap="nowrap"
      className="rounded-md border border-border bg-card transition-colors hover:bg-accent"
    >
      <Link
        to={APP_ROUTES.TANGENT_PROJECT}
        params={{ projectId: project.id }}
        className="flex min-w-0 items-center gap-2 py-2 pl-3"
        {...tracking("projects.pinned_project")}
      >
        <Icon
          name="Folder"
          size="sm"
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Text size="sm" weight="medium" className="max-w-48 truncate">
          {project.name}
        </Text>
        <Text size="xs" tone="subdued" className="hidden truncate sm:block">
          {formatResourceCounts(project.resourceCounts)}
        </Text>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        onClick={togglePin}
        aria-label={`Unpin ${project.name}`}
        title="Unpin"
        className="mx-1 size-7 shrink-0 text-muted-foreground hover:text-foreground"
        {...tracking("projects.pin_project", { new_value: false })}
      >
        <Icon name="PinOff" size="xs" />
      </Button>
    </InlineStack>
  );
}
