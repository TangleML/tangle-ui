import { type ChangeEvent, type KeyboardEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { useValidationResolutionActions } from "@/routes/v2/pages/Editor/components/IssueResolution/useValidationResolutionActions";
import { tracking } from "@/utils/tracking";

export function DuplicateNameResolution({
  issue,
  spec,
  entityType,
}: {
  issue: ValidationIssue;
  spec: ComponentSpec;
  entityType: "input" | "output";
}) {
  const { renameDuplicate, deleteDuplicate } = useValidationResolutionActions();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    const trimmed = value.trim();
    if (!trimmed || !issue.entityId) return;

    renameDuplicate(spec, entityType, issue.entityId, trimmed);
    setValue("");
  };

  const handleDelete = () => {
    if (!issue.entityId) return;
    deleteDuplicate(spec, entityType, issue.entityId);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleRename();
  };

  return (
    <BlockStack gap="3">
      <BlockStack gap="2">
        <Text size="xs" weight="semibold" tone="subdued">
          Rename {entityType}
        </Text>
        <InlineStack gap="2" blockAlign="end">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setValue(e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder={`New ${entityType} name...`}
            className="h-8 text-xs flex-1"
            autoFocus
          />
          <Button
            size="sm"
            {...tracking(
              "v2.pipeline_editor.pipeline_tree.resolution.duplicate_rename",
            )}
            onClick={handleRename}
            disabled={!value.trim()}
          >
            Rename
          </Button>
        </InlineStack>
      </BlockStack>

      <div className="border-t border-slate-200 pt-2">
        <Text size="xs" tone="subdued" className="mb-2">
          Or remove the duplicate:
        </Text>
        <Button
          variant="destructive"
          size="sm"
          {...tracking(
            "v2.pipeline_editor.pipeline_tree.resolution.duplicate_delete",
          )}
          onClick={handleDelete}
        >
          <Icon name="Trash2" size="xs" />
          Delete {entityType}
        </Button>
      </div>
    </BlockStack>
  );
}
