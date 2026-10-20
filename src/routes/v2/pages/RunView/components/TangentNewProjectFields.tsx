import { WorkspaceNotice } from "@/components/Project/WorkspaceNotice";
import { WorkspaceField } from "@/components/Project/WorkspaceSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import type { WorkspaceChoice } from "@/services/projects/useWorkspaceChoice";

interface TangentNewProjectFieldsProps {
  name: string;
  onNameChange: (name: string) => void;
  workspaceChoice: WorkspaceChoice;
}

export function TangentNewProjectFields({
  name,
  onNameChange,
  workspaceChoice,
}: TangentNewProjectFieldsProps) {
  return (
    <BlockStack gap="4" className="px-2">
      <BlockStack gap="2">
        <Label htmlFor="tangent-destination-name">Name</Label>
        <Input
          id="tangent-destination-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoFocus
        />
      </BlockStack>
      <WorkspaceField choice={workspaceChoice} />
      <WorkspaceNotice />
    </BlockStack>
  );
}
