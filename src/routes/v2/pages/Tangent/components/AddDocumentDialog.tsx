import { DocumentForm } from "@/components/Project/DocumentForm";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type { DocumentKind } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";

interface AddDocumentDialogProps {
  kind?: DocumentKind;
}

const COPY: Record<DocumentKind, { title: string; description: string }> = {
  document: {
    title: "Add a document",
    description: "Write a document for this project.",
  },
  code: {
    title: "Add code",
    description: "Add a code file to this project.",
  },
};

export function AddDocumentDialog({
  close,
  cancel,
  kind = "document",
}: DialogProps<CreateResourceInput, AddDocumentDialogProps>) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{COPY[kind].title}</DialogTitle>
        <DialogDescription className="sr-only">
          {COPY[kind].description}
        </DialogDescription>
      </DialogHeader>
      <DocumentForm kind={kind} onSubmit={close} onCancel={cancel} />
    </>
  );
}
