import { useRef, useState } from "react";

import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/utils/componentSpec";

import { PipelineDescriptionEditor } from "./PipelineDescriptionEditor";
import { useProcessedDescription } from "./useProcessedDescription";

export const PipelineDescription = ({
  componentSpec,
  readOnly,
}: {
  componentSpec: ComponentSpec;
  readOnly?: boolean;
}) => {
  const processedDescription = useProcessedDescription();
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasDescription = Boolean(
    componentSpec.description && componentSpec.description.trim(),
  );

  // If no description, always show editor
  if (!hasDescription) {
    return <PipelineDescriptionEditor />;
  }

  // If editing, show editor
  if (isEditing) {
    return (
      <div
        className="w-full"
        ref={containerRef}
        onBlur={(event) => {
          // Only exit edit mode if focus moves outside the container
          if (!containerRef.current?.contains(event.relatedTarget)) {
            setIsEditing(false);
          }
        }}
      >
        <PipelineDescriptionEditor autoFocus />
      </div>
    );
  }

  if (readOnly) {
    return (
      <BlockStack gap="1">
        <Heading level={3}>Description</Heading>
        {processedDescription ? (
          <CopyText className="text-xs">{processedDescription}</CopyText>
        ) : (
          <Text size="xs">No description</Text>
        )}
      </BlockStack>
    );
  }

  // Show resolved description with click to edit
  return (
    <BlockStack gap="1">
      <Heading level={3}>Description</Heading>
      <div
        className="w-full cursor-pointer whitespace-pre-wrap rounded-md border border-transparent px-3 py-2 text-sm hover:border-input hover:bg-muted/50"
        onClick={() => setIsEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            setIsEditing(true);
          }
        }}
        role="button"
        tabIndex={0}
        data-testid="pipeline-description-display"
        title="Click to edit"
      >
        {processedDescription}
      </div>
    </BlockStack>
  );
};
