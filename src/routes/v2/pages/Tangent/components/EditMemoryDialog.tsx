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

interface EditMemoryDialogProps {
  currentMemory: string;
}

export function EditMemoryDialog({
  close,
  cancel,
  currentMemory,
}: DialogProps<string, EditMemoryDialogProps>) {
  const [draft, setDraft] = useState(currentMemory);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    close(draft);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit memory</DialogTitle>
        <DialogDescription>
          Standing context for agents in this project. Injected into each
          session as memory.
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
