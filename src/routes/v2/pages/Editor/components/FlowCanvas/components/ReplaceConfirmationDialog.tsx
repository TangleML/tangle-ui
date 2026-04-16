import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InputSpec } from "@/models/componentSpec";
import type { OutputSpec } from "@/models/componentSpec/entities/types";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type { EntityDiff } from "@/routes/v2/pages/Editor/store/actions/task.utils";

import { ReplaceConfirmationContent } from "./ReplaceConfirmationContent";

interface ReplaceConfirmationDialogExtraProps {
  taskName: string;
  newComponentName: string;
  inputDiff: EntityDiff<InputSpec>;
  outputDiff: EntityDiff<OutputSpec>;
}

export function ReplaceConfirmationDialog({
  close,
  cancel,
  taskName,
  newComponentName,
  inputDiff,
  outputDiff,
}: DialogProps<boolean> & ReplaceConfirmationDialogExtraProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Replace Task?</DialogTitle>
        <DialogDescription>
          This will replace the task&apos;s component reference.
        </DialogDescription>
      </DialogHeader>
      <ReplaceConfirmationContent
        taskName={taskName}
        newComponentName={newComponentName}
        inputDiff={inputDiff}
        outputDiff={outputDiff}
      />
      <DialogFooter>
        <Button variant="outline" onClick={cancel}>
          Cancel
        </Button>
        <Button onClick={() => close(true)} autoFocus>
          Continue
        </Button>
      </DialogFooter>
    </>
  );
}
