import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { RepositoryLinkForm } from "./RepositoryLinkForm";

interface LinkRepositoryDialogProps {
  projectId: string;
  resources: ProjectResourceSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkRepositoryDialog({
  projectId,
  resources,
  open,
  onOpenChange,
}: LinkRepositoryDialogProps) {
  const createResource = useCreateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const handleSubmit = (input: CreateResourceInput) => {
    createResource.mutate(input, {
      onSuccess: () => {
        track("projects.link_repository_completed");
        notify("Repository linked", "success");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a repository</DialogTitle>
          <DialogDescription>
            Link a public GitHub repository, or one folder in it, to this
            project.
          </DialogDescription>
        </DialogHeader>
        <RepositoryLinkForm
          key={String(open)}
          resources={resources}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={createResource.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
