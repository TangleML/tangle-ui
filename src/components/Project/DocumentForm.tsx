import { type FormEvent, useState } from "react";

import { languageFor } from "@/components/shared/CodeViewer";
import CodeEditor from "@/components/shared/CodeViewer/CodeEditor";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useFileDrop } from "@/hooks/useFileDrop";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { documentResourceInput } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

import { readDocumentFile } from "./documentFile";
import { DocumentFileDropZone } from "./DocumentFileDropZone";

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
  const { track } = useAnalytics();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleFromFile, setTitleFromFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fillFromFile = async (file: File, method: "drop" | "browse") => {
    if (isSubmitting) return;

    const result = await readDocumentFile(file);
    if (!result.ok) {
      setFileError(result.error);
      return;
    }

    setFileError(null);
    setTitle((current) =>
      current.trim() === "" || current === titleFromFile
        ? result.title
        : current,
    );
    setTitleFromFile(result.title);
    setContent(result.content);
    track("projects.add_document_from_file_completed", { method });
  };

  const { isDraggingFile, dropTargetProps } = useFileDrop(
    (file) => void fillFromFile(file, "drop"),
  );

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
    <form onSubmit={handleSubmit} className="min-w-0" {...dropTargetProps}>
      <BlockStack gap="4">
        <DocumentFileDropZone
          isDraggingFile={isDraggingFile}
          error={fileError}
          disabled={isSubmitting}
          onFileChosen={(file) => void fillFromFile(file, "browse")}
        />

        <BlockStack gap="2">
          <Label htmlFor="add-document-title">Title</Label>
          <Input
            id="add-document-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="model-card.md"
            autoFocus
          />
        </BlockStack>

        <BlockStack gap="2">
          <Label>Content</Label>
          <div className="h-[50vh] min-h-40 w-full overflow-hidden rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <CodeEditor
              value={content}
              language={languageFor(trimmedTitle)}
              onChange={setContent}
              options={{
                ariaLabel: "Content",
                placeholder: "What this document records",
              }}
            />
          </div>
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
