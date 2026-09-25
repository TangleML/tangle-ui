import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import type { Project } from "@/services/projects/types";
import { copyToClipboard } from "@/utils/string";
import { tracking } from "@/utils/tracking";
import { getProjectUrl } from "@/utils/URL";

import { RenameProjectDialog } from "./RenameProjectDialog";
import { useDeleteProjectAction } from "./useDeleteProjectAction";

interface ProjectActionsProps {
  project: Project;
}

export function ProjectActions({ project }: ProjectActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const notify = useToastNotification();
  const { confirmAndDelete, confirmation } = useDeleteProjectAction(project);

  const handleShare = () => {
    copyToClipboard(getProjectUrl(project.id));
    notify("Project URL copied to clipboard", "success");
  };

  return (
    <BlockStack gap="1">
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
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={handleShare}
        {...tracking("projects.share_project")}
      >
        <Icon name="Share2" size="sm" />
        Share project
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-destructive hover:text-destructive"
        onClick={() => void confirmAndDelete()}
        {...tracking("projects.delete_project_open")}
      >
        <Icon name="Trash2" size="sm" />
        Delete project
      </Button>

      <RenameProjectDialog
        project={project}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      <ConfirmationDialog {...confirmation} />
    </BlockStack>
  );
}
