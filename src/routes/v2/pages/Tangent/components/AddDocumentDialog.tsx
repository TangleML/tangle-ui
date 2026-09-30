import { DocumentForm } from "@/components/Project/DocumentForm";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type { CreateResourceInput } from "@/services/projects/types";

export function AddDocumentDialog({
  close,
  cancel,
}: DialogProps<CreateResourceInput>) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a document</DialogTitle>
        <DialogDescription className="sr-only">
          Write a document for this project.
        </DialogDescription>
      </DialogHeader>
      <DocumentForm onSubmit={close} onCancel={cancel} />
    </>
  );
}
