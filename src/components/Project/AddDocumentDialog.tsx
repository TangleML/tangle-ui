import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { CreateResourceInput } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { DocumentForm } from "./DocumentForm";

interface AddDocumentDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDocumentDialog({
  projectId,
  open,
  onOpenChange,
}: AddDocumentDialogProps) {
  const createResource = useCreateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();

  useEffect(() => {
    if (open) {
      track("projects.add_document_dialog_impression");
    }
  }, [open, track]);

  const handleSubmit = (input: CreateResourceInput) => {
    createResource.mutate(input, {
      onSuccess: () => {
        track("projects.add_document_completed");
        notify("Document added", "success");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>
        {/* Keyed on `open` so a dialog reopened after a cancel starts empty:
            the fields live in the form, which the dialog keeps mounted. */}
        <DocumentForm
          key={String(open)}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={createResource.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
