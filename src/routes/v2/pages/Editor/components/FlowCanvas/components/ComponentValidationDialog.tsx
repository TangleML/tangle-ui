import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import type { DialogProps } from "@/providers/DialogProvider/types";

interface ComponentValidationDialogProps {
  title: string;
  componentName: string;
  errors: string[];
}

export function ComponentValidationDialog({
  close,
  title,
  componentName,
  errors,
}: DialogProps & ComponentValidationDialogProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          &quot;{componentName}&quot; was not added to the pipeline.
        </DialogDescription>
      </DialogHeader>
      <BlockStack
        as="ul"
        gap="2"
        className="my-4 max-h-72 overflow-y-auto list-disc pl-5 text-sm break-words"
      >
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </BlockStack>
      <DialogFooter>
        <Button onClick={() => close()} autoFocus>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
