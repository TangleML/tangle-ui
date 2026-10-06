import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import type { Project } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

import { RenameProjectDialog } from "./RenameProjectDialog";
import { useDeleteProjectAction } from "./useDeleteProjectAction";
import { useShareProjectAction } from "./useShareProjectAction";

interface ProjectActionsProps {
  project: Project;
  showRename?: boolean;
}

/**
 * Tangent renames from its own header, so it asks for the list without that
 * entry rather than offering the project two ways to be renamed.
 */
export function ProjectActions({
  project,
  showRename = true,
}: ProjectActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const { confirmAndDelete, isDeleting, confirmation } = useDeleteProjectAction(
    project,
    { navigateAfterDelete: true },
  );
  const share = useShareProjectAction(project.id);

  return (
    <BlockStack gap="1">
      {showRename && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => setRenameOpen(true)}
          {...tracking("projects.rename_project_open")}
        >
          <Icon name="Pencil" size="sm" />
          Rename project
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={share}
        {...tracking("projects.share_project")}
      >
        <Icon name="Share2" size="sm" />
        Share project
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-destructive hover:text-destructive"
        disabled={isDeleting}
        onClick={() => void confirmAndDelete()}
        {...tracking("projects.delete_project_open")}
      >
        <Icon name="Trash2" size="sm" />
        Delete project
      </Button>

      {showRename && (
        <RenameProjectDialog
          project={project}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
      )}

      <ConfirmationDialog {...confirmation} />
    </BlockStack>
  );
}
