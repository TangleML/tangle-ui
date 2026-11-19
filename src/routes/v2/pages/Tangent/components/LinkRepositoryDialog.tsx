import { RepositoryLinkForm } from "@/components/Project/RepositoryLinkForm";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DialogProps } from "@/providers/DialogProvider/types";
import { useArchivedProjectItems } from "@/routes/v2/pages/Tangent/hooks/useArchivedProjectItems";
import { repositoryKey } from "@/routes/v2/pages/Tangent/services/projectArchive";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";
import { useDeleteProjectResource } from "@/services/projects/useProjectResources";

interface LinkRepositoryDialogProps {
  projectId: string;
  resources: ProjectResourceSummary[];
}

/**
 * Closes with the input to link, or with nothing when the repository was only
 * restored from the archive, so the caller creates a resource in the first
 * case alone.
 */
export function LinkRepositoryDialog({
  close,
  cancel,
  projectId,
  resources,
}: DialogProps<CreateResourceInput, LinkRepositoryDialogProps>) {
  const { archived, restore } = useArchivedProjectItems(projectId);
  const deleteResource = useDeleteProjectResource(projectId);

  const handleRestore = (linked: ProjectResourceSummary) => {
    restore(repositoryKey(linked.id));
    close();
  };

  const handleReplace = (
    linked: ProjectResourceSummary,
    input: CreateResourceInput,
  ) => {
    deleteResource.mutate(linked.id, { onSuccess: () => close(input) });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Link a repository</DialogTitle>
        <DialogDescription>
          Link a GitHub repository, or one folder in it, to this project.
        </DialogDescription>
      </DialogHeader>
      <RepositoryLinkForm
        resources={resources}
        onSubmit={close}
        onCancel={cancel}
        isSubmitting={deleteResource.isPending}
        isArchived={(linked) => archived.has(repositoryKey(linked.id))}
        onRestore={handleRestore}
        onReplace={handleReplace}
      />
    </>
  );
}
