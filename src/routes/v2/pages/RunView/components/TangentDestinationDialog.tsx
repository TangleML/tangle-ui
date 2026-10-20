import { type FormEvent, useState } from "react";

import { PickerOption } from "@/components/Project/PickerOption";
import { PickerSearchField } from "@/components/Project/PickerSearchField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import type { TangentDestination } from "@/routes/v2/pages/RunView/hooks/useRunTangentHandoff";
import {
  NEW_PROJECT,
  useTangentDestinationChoice,
} from "@/routes/v2/pages/RunView/hooks/useTangentDestinationChoice";
import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useWorkspaceChoice } from "@/services/projects/useWorkspaceChoice";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { tracking } from "@/utils/tracking";

import { TangentDestinationProjects } from "./TangentDestinationProjects";
import { TangentNewProjectFields } from "./TangentNewProjectFields";

function destinationFor(
  picked: string | undefined,
  name: string,
  workspace: Workspace | undefined,
): TangentDestination | undefined {
  if (picked === undefined) return undefined;
  if (picked !== NEW_PROJECT) return { kind: "existing", projectId: picked };
  if (name === "" || !workspace) return undefined;
  return { kind: "new", workspaceId: workspace.id, name };
}

interface TangentDestinationDialogProps {
  title: string;
  attributed: readonly ProjectSummary[];
  newProjectName: string;
  onChoose: (destination: TangentDestination) => void;
  onDismiss: () => void;
}

export function TangentDestinationDialog({
  title,
  attributed,
  newProjectName,
  onChoose,
  onDismiss,
}: TangentDestinationDialogProps) {
  const [name, setName] = useState(newProjectName);
  const { data: workspaces } = useWorkspaces();
  const workspaceChoice = useWorkspaceChoice(workspaces);
  const choice = useTangentDestinationChoice(attributed, workspaces);

  const isNewProject = choice.picked === NEW_PROJECT;
  const destination = destinationFor(
    choice.picked,
    name.trim(),
    workspaceChoice.selected,
  );

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (destination) onChoose(destination);
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onDismiss())}>
      <DialogContent className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick a project to work in, or start a new one.
          </DialogDescription>
        </DialogHeader>

        {choice.hasProjects && (
          <PickerSearchField
            label="Search projects"
            value={choice.query}
            onChange={choice.setQuery}
          />
        )}

        <TangentDestinationProjects choice={choice} />

        <Separator />

        <form onSubmit={confirm}>
          <BlockStack gap="4">
            <PickerOption
              icon="Plus"
              label="New project"
              isSelected={isNewProject}
              onClick={() => choice.toggle(NEW_PROJECT)}
              trackingId="v2.run_view.tangent_destination.new_project"
            />

            {isNewProject && (
              <TangentNewProjectFields
                name={name}
                onNameChange={setName}
                workspaceChoice={workspaceChoice}
              />
            )}

            <DialogFooter className="w-full">
              <InlineStack gap="2" className="w-full" align="end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDismiss}
                  {...tracking("v2.run_view.tangent_destination.cancel")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!destination}
                  {...tracking("v2.run_view.tangent_destination.confirm", {
                    new_project: isNewProject,
                    workspace_changed:
                      isNewProject && workspaceChoice.changedFromDefault,
                  })}
                >
                  Confirm
                </Button>
              </InlineStack>
            </DialogFooter>
          </BlockStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
