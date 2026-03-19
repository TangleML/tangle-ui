import { type ChangeEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { renameEntity } from "@/routes/v2/pages/Editor/components/PipelineTreeContent/components/validationResolution.actions";
import { setSelectedValidationIssue } from "@/routes/v2/shared/store/editorStore";

export function RenameEntityResolution({
  issue,
  spec,
  entityType,
}: {
  issue: ValidationIssue;
  spec: ComponentSpec;
  entityType: "task" | "input" | "output" | "component";
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    renameEntity(spec, entityType, issue.entityId, trimmed);
    setValue("");
    setSelectedValidationIssue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
  };

  const label = entityType === "component" ? "component" : entityType;

  return (
    <BlockStack gap="2">
      <Text size="xs" weight="semibold" className="text-gray-700">
        Set {label} name
      </Text>
      <InlineStack gap="2" blockAlign="end">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setValue(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${label} name...`}
          className="h-8 text-xs flex-1"
          autoFocus
        />
        <Button size="sm" onClick={handleSave} disabled={!value.trim()}>
          Save
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
