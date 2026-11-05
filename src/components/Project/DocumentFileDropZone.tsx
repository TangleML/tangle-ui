import { type ChangeEvent, useRef } from "react";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/field-message";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DocumentDescriptorType } from "@/services/projects/resourceDescriptor";
import { tracking } from "@/utils/tracking";

import { DOCUMENT_TYPE_COPY } from "./documentTypeCopy";

interface DocumentFileDropZoneProps {
  kind: DocumentDescriptorType;
  isDraggingFile: boolean;
  error: string | null;
  disabled: boolean;
  onFileChosen: (file: File) => void;
}

export function DocumentFileDropZone({
  kind,
  isDraggingFile,
  error,
  disabled,
  onFileChosen,
}: DocumentFileDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFileChosen(file);
  };

  return (
    <BlockStack gap="1" aria-live="polite">
      <InlineStack
        gap="2"
        align="center"
        className={cn(
          "w-full rounded-md border border-dashed px-3 py-3 transition-colors",
          isDraggingFile ? "border-primary bg-primary/5" : "border-input",
        )}
      >
        <Icon name="FileUp" size="sm" className="text-muted-foreground" />
        {isDraggingFile ? (
          <Text size="xs" tone="subdued">
            {DOCUMENT_TYPE_COPY[kind].dropHint}
          </Text>
        ) : (
          <Text size="xs" tone="subdued">
            Drop a text file here, or{" "}
            <Button
              type="button"
              variant="link"
              size="inline-xs"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              {...tracking("projects.add_document_browse_file", { kind })}
            >
              browse
            </Button>
          </Text>
        )}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={handleFileChange}
          data-testid="document-file-input"
        />
      </InlineStack>
      {error && (
        <FieldMessage tone="critical" icon="CircleAlert">
          {error}
        </FieldMessage>
      )}
    </BlockStack>
  );
}
