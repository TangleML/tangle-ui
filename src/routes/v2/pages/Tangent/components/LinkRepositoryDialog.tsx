import { RepositoryLinkForm } from "@/components/Project/RepositoryLinkForm";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";

export interface LinkRepositoryDialogProps {
  resources: ProjectResourceSummary[];
}

export function LinkRepositoryDialog({
  close,
  cancel,
  resources,
}: DialogProps<CreateResourceInput, LinkRepositoryDialogProps>) {
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
      />
    </>
  );
}
