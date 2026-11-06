import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { DocumentKind } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { DocumentForm } from "./DocumentForm";

const TITLE: Record<DocumentKind, string> = {
  document: "Add Document",
  code: "Add Code",
};

const ADDED: Record<DocumentKind, string> = {
  document: "Document added",
  code: "Code added",
};

interface AddDocumentDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: DocumentKind;
}

export function AddDocumentDialog({
  projectId,
  open,
  onOpenChange,
  kind = "document",
}: AddDocumentDialogProps) {
  const createResource = useCreateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();

  useEffect(() => {
    if (open) {
      track("projects.add_document_dialog_impression", { kind });
    }
  }, [open, track, kind]);

  const handleSubmit = (input: CreateResourceInput) => {
    createResource.mutate(input, {
      onSuccess: () => {
        track("projects.add_document_completed", { kind });
        notify(ADDED[kind], "success");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{TITLE[kind]}</DialogTitle>
        </DialogHeader>
        {/* Keyed on `open` so a dialog reopened after a cancel starts empty:
            the fields live in the form, which the dialog keeps mounted. */}
        <DocumentForm
          key={String(open)}
          kind={kind}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={createResource.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
