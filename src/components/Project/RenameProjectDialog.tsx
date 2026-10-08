import { RenameDialog } from "@/components/shared/Dialogs/RenameDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { withoutProvisionalName } from "@/services/projects/provisionalName";
import type { Project } from "@/services/projects/types";
import { useUpdateProject } from "@/services/projects/useProjects";

interface RenameProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameProjectDialog({
  project,
  open,
  onOpenChange,
}: RenameProjectDialogProps) {
  const updateProject = useUpdateProject();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const handleRename = (name: string) => {
    updateProject.mutate(
      {
        id: project.id,
        input: {
          name,
          // A name someone typed is a deliberate one, so the agent stops
          // offering to replace it.
          metadata: withoutProvisionalName(project.metadata),
        },
      },
      {
        onSuccess: () => {
          track("projects.rename_project_completed");
          notify("Project renamed", "success");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <RenameDialog
      open={open}
      title="Rename Project"
      description="Give this project a different name."
      currentName={project.name}
      isSaving={updateProject.isPending}
      trackingPrefix="projects.rename_project"
      onRename={handleRename}
      onOpenChange={onOpenChange}
    />
  );
}
