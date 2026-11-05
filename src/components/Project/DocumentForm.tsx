import { type FormEvent, useRef, useState } from "react";

import { languageFor } from "@/components/shared/CodeViewer";
import CodeEditor from "@/components/shared/CodeViewer/CodeEditor";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import {
  type DocumentKind,
  documentResourceInput,
} from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

import { readDocumentFile } from "./documentFile";
import { DocumentFileDropZone } from "./DocumentFileDropZone";
import { useFileDrop } from "./useFileDrop";

interface KindCopy {
  nameLabel: string;
  namePlaceholder: string;
  contentPlaceholder: string;
}

const KIND_COPY: Record<DocumentKind, KindCopy> = {
  document: {
    nameLabel: "Title",
    namePlaceholder: "model-card.md",
    contentPlaceholder: "What this document records",
  },
  code: {
    nameLabel: "Filename",
    namePlaceholder: "train.py",
    contentPlaceholder: "The source code",
  },
};

interface DocumentFormProps {
  onSubmit: (input: CreateResourceInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  kind?: DocumentKind;
}

export function DocumentForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  kind = "document",
}: DocumentFormProps) {
  const copy = KIND_COPY[kind];
  const { track } = useAnalytics();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleFromFile, setTitleFromFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const latestReadId = useRef(0);

  const fillFromFile = async (file: File, method: "drop" | "browse") => {
    if (isSubmitting) return;

    const readId = ++latestReadId.current;
    setIsReadingFile(true);
    const result = await readDocumentFile(file);
    if (readId !== latestReadId.current) return;

    setIsReadingFile(false);
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
    track("projects.add_document_from_file_completed", { method, kind });
  };

  const { isDraggingFile, dropTargetProps } = useFileDrop(
    (file) => void fillFromFile(file, "drop"),
  );

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const canSubmit =
    trimmedTitle !== "" &&
    trimmedContent !== "" &&
    !isSubmitting &&
    !isReadingFile;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(documentResourceInput(kind, trimmedTitle, trimmedContent));
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
          <Label htmlFor="add-document-title">{copy.nameLabel}</Label>
          <Input
            id="add-document-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.namePlaceholder}
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
                placeholder: copy.contentPlaceholder,
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
              {...tracking("projects.add_document_cancel", { kind })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              {...tracking("projects.add_document_submit", { kind })}
            >
              Add
            </Button>
          </InlineStack>
        </DialogFooter>
      </BlockStack>
    </form>
  );
}
