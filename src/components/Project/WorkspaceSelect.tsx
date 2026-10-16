import { useId } from "react";

import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import type { WorkspaceChoice } from "@/services/projects/useWorkspaceChoice";

interface WorkspaceSelectProps {
  choice: WorkspaceChoice;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function WorkspaceSelect({
  choice,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  placeholder,
  disabled,
  className,
}: WorkspaceSelectProps) {
  return (
    <Select
      value={choice.selected?.id ?? ""}
      onValueChange={choice.choose}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={className}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {choice.workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface WorkspaceFieldProps {
  choice: WorkspaceChoice;
}

export function WorkspaceField({ choice }: WorkspaceFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <BlockStack gap="2">
      <Label htmlFor={id}>Workspace</Label>
      <WorkspaceSelect
        choice={choice}
        id={id}
        aria-describedby={hintId}
        className="w-full"
      />
      <Text id={hintId} size="xs" tone="subdued">
        The workspace cannot be changed after the project is created.
      </Text>
    </BlockStack>
  );
}
