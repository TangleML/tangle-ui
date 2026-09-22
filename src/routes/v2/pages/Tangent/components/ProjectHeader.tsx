import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { RenameProjectDialog } from "@/components/Project/RenameProjectDialog";
import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useProject } from "@/services/projects/useProjects";
import { tracking } from "@/utils/tracking";

export function ProjectHeader() {
  const store = useTangentProject();
  const { data: project } = useProject(store.projectId);
  const [renameOpen, setRenameOpen] = useState(false);

  if (!project) return null;

  return (
    <InlineStack
      align="space-between"
      blockAlign="center"
      gap="3"
      className="shrink-0 border-b border-border px-4 py-2"
    >
      <InlineStack
        gap="1"
        blockAlign="center"
        wrap="nowrap"
        className="min-w-0"
      >
        <Link
          to={APP_ROUTES.PROJECT_DETAIL}
          params={{ projectId: project.id }}
          title="Project details"
          className="min-w-0 rounded-md px-2 py-1 hover:bg-accent"
          {...tracking("tangent.open_project_details")}
        >
          <InlineStack gap="2" blockAlign="center" wrap="nowrap">
            <Icon
              name="Folder"
              size="sm"
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <Heading level={2} size="sm" className="min-w-0 truncate">
              {project.name}
            </Heading>
          </InlineStack>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRenameOpen(true)}
          aria-label={`Rename ${project.name}`}
          title="Rename project"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          {...tracking("tangent.rename_project_open")}
        >
          <Icon name="Pencil" size="sm" />
        </Button>

        <FavoriteToggle
          type="project"
          id={project.id}
          name={project.name}
          analyticsActionType="tangent.favorite_project"
        />
      </InlineStack>

      <RenameProjectDialog
        project={project}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
    </InlineStack>
  );
}
