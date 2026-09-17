import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createResource = useCreateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();

  useEffect(() => {
    if (open) {
      track("projects.add_document_dialog_impression");
    }
  }, [open, track]);

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const canSubmit =
    trimmedTitle !== "" && trimmedContent !== "" && !createResource.isPending;

  const resetForm = () => {
    setTitle("");
    setContent("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    createResource.mutate(
      {
        entity: "document",
        name: trimmedTitle,
        // The backend requires a payload for a document and validates nothing
        // inside it; `content` is this app's convention for the whole body.
        payload: { content: trimmedContent },
      },
      {
        onSuccess: () => {
          track("projects.add_document_completed");
          notify("Document added", "success");
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <BlockStack gap="4">
            <BlockStack gap="2">
              <Label htmlFor="add-document-title">Title</Label>
              <Input
                id="add-document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Model card"
                autoFocus
              />
            </BlockStack>

            <BlockStack gap="2">
              <Label htmlFor="add-document-content">Content</Label>
              <Textarea
                id="add-document-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="What this document records"
                className="min-h-32"
              />
            </BlockStack>

            <DialogFooter className="w-full">
              <InlineStack gap="2" className="w-full" align="end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  {...tracking("projects.add_document_cancel")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  {...tracking("projects.add_document_submit")}
                >
                  Add
                </Button>
              </InlineStack>
            </DialogFooter>
          </BlockStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
