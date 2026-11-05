import { DocumentForm } from "@/components/Project/DocumentForm";
import { DOCUMENT_TYPE_COPY } from "@/components/Project/documentTypeCopy";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type { DocumentDescriptorType } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";

interface AddDocumentDialogProps {
  kind?: DocumentDescriptorType;
}

export function AddDocumentDialog({
  close,
  cancel,
  kind = "document",
}: DialogProps<CreateResourceInput, AddDocumentDialogProps>) {
  const copy = DOCUMENT_TYPE_COPY[kind];
  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.addLabel}</DialogTitle>
        <DialogDescription className="sr-only">
          {copy.addDescription}
        </DialogDescription>
      </DialogHeader>
      <DocumentForm kind={kind} onSubmit={close} onCancel={cancel} />
    </>
  );
}
