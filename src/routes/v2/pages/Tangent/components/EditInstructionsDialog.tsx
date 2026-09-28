import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import type { DialogProps } from "@/providers/DialogProvider/types";

interface EditInstructionsDialogProps {
  currentInstructions: string;
}

export function EditInstructionsDialog({
  close,
  cancel,
  currentInstructions,
}: DialogProps<string, EditInstructionsDialogProps>) {
  const [draft, setDraft] = useState(currentInstructions);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    close(draft);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit instructions</DialogTitle>
        <DialogDescription>
          Standing context for agents in this project. Injected into each
          session.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <BlockStack gap="4">
          <Textarea
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Standing context for agents in this project…"
            className="min-h-60"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </BlockStack>
      </form>
    </>
  );
}
