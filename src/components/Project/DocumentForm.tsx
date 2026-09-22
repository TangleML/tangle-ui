import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { documentResourceInput } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

interface DocumentFormProps {
  onSubmit: (input: CreateResourceInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DocumentForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: DocumentFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const canSubmit =
    trimmedTitle !== "" && trimmedContent !== "" && !isSubmitting;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(documentResourceInput(trimmedTitle, trimmedContent));
  };

  return (
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
              onClick={onCancel}
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
  );
}
