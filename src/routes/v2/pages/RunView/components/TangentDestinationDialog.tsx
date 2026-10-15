import { type FormEvent, useId, useState } from "react";

import { NO_WORKSPACE_AVAILABLE } from "@/components/Project/workspaceCopy";
import { WorkspaceField } from "@/components/Project/WorkspaceSelect";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radiogroup";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import type { TangentDestination } from "@/routes/v2/pages/RunView/hooks/useRunTangentHandoff";
import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useReachableProjects } from "@/services/projects/useReachableProjects";
import type { WorkspaceChoice } from "@/services/projects/useWorkspaceChoice";
import { useWorkspaceChoice } from "@/services/projects/useWorkspaceChoice";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { tracking } from "@/utils/tracking";

const NEW_PROJECT = "new-project";

interface TangentDestinationDialogProps {
  title: string;
  createLabel: string;
  attributed: readonly ProjectSummary[];
  newProjectName: string;
  onChoose: (destination: TangentDestination) => void;
  onDismiss: () => void;
}

export function TangentDestinationDialog({
  title,
  createLabel,
  attributed,
  newProjectName,
  onChoose,
  onDismiss,
}: TangentDestinationDialogProps) {
  const [step, setStep] = useState<"pick" | "create">("pick");
  const [selected, setSelected] = useState<string>();
  const [name, setName] = useState(newProjectName);
  const {
    data: workspaces,
    isPending: isWorkspacesPending,
    error,
  } = useWorkspaces();
  const workspaceChoice = useWorkspaceChoice(workspaces);

  const workspaceNotice = error
    ? `Could not load workspaces: ${error.message}`
    : !isWorkspacesPending && !workspaceChoice.selected
      ? NO_WORKSPACE_AVAILABLE
      : undefined;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onDismiss())}>
      <DialogContent className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? "Pick a project to work in, or start a new one."
              : "Name the new project and pick its workspace."}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <PickProjectStep
            attributed={attributed}
            workspaces={workspaces}
            selected={selected}
            onSelect={setSelected}
            onConfirm={(choice) =>
              choice === NEW_PROJECT
                ? setStep("create")
                : onChoose({ kind: "existing", projectId: choice })
            }
            onCancel={onDismiss}
          />
        ) : (
          <CreateProjectStep
            name={name}
            onNameChange={setName}
            workspaceChoice={workspaceChoice}
            workspaceNotice={workspaceNotice}
            createLabel={createLabel}
            onCreate={(workspaceId) =>
              onChoose({ kind: "new", workspaceId, name: name.trim() })
            }
            onBack={() => setStep("pick")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PickProjectStepProps {
  attributed: readonly ProjectSummary[];
  workspaces: readonly Workspace[] | undefined;
  selected: string | undefined;
  onSelect: (choice: string) => void;
  onConfirm: (choice: string) => void;
  onCancel: () => void;
}

function PickProjectStep({
  attributed,
  workspaces,
  selected,
  onSelect,
  onConfirm,
  onCancel,
}: PickProjectStepProps) {
  const [query, setQuery] = useState("");
  const reachable = useReachableProjects();

  const attributedIds = new Set(attributed.map((project) => project.id));
  const others = reachable.projects.filter(
    (project) => !attributedIds.has(project.id),
  );
  const listed = [...attributed, ...others];
  const hasNoProjects = !reachable.isPending && listed.length === 0;
  const workspaceNames =
    new Set(listed.map((project) => project.workspaceId)).size > 1
      ? new Map(workspaces?.map((workspace) => [workspace.id, workspace.name]))
      : undefined;

  const needle = query.trim().toLowerCase();
  const matches = (project: ProjectSummary) =>
    project.name.toLowerCase().includes(needle);
  const attributedMatches = attributed.filter(matches);
  const otherMatches = others.filter(matches);
  const visible = [...attributedMatches, ...otherMatches].map(
    (project) => project.id,
  );

  const choice =
    selected === NEW_PROJECT || (selected && visible.includes(selected))
      ? selected
      : hasNoProjects
        ? NEW_PROJECT
        : undefined;

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (choice) onConfirm(choice);
  };

  return (
    <form onSubmit={confirm} className="flex min-h-0 flex-1 flex-col gap-4">
      {listed.length > 0 && (
        <div className="relative w-full">
          <Icon
            name="Search"
            size="sm"
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onEscape={() => setQuery("")}
            placeholder="Search projects"
            aria-label="Search projects"
            className="pl-7"
            autoFocus
          />
        </div>
      )}

      <RadioGroup
        value={choice ?? ""}
        onValueChange={onSelect}
        aria-label="Project"
        className="flex min-h-0 flex-1 flex-col gap-2"
      >
        <BlockStack gap="4" className="min-h-0 flex-1 overflow-y-auto">
          {attributedMatches.length > 0 && (
            <ProjectOptions
              heading="This run's projects"
              projects={attributedMatches}
              workspaceNames={workspaceNames}
            />
          )}

          {otherMatches.length > 0 && (
            <ProjectOptions
              heading="Your projects"
              projects={otherMatches}
              workspaceNames={workspaceNames}
            />
          )}

          {reachable.isPending && (
            <InlineStack gap="2" blockAlign="center">
              <Spinner /> Loading...
            </InlineStack>
          )}

          {reachable.error && (
            <InfoBox title="Error loading projects" variant="error">
              {reachable.error.message}
            </InfoBox>
          )}

          {listed.length > 0 && visible.length === 0 && (
            <Text size="sm" tone="subdued">
              No projects match that.
            </Text>
          )}
        </BlockStack>

        <Separator />
        <ChoiceOption value={NEW_PROJECT} icon="Plus" label="New project" />
      </RadioGroup>

      <DialogFooter className="w-full">
        <InlineStack gap="2" className="w-full" align="end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            {...tracking("v2.run_view.tangent_destination.cancel")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!choice}
            {...tracking(
              choice === NEW_PROJECT
                ? "v2.run_view.tangent_destination.new_project"
                : "v2.run_view.tangent_destination.confirm",
            )}
          >
            {choice === NEW_PROJECT ? "Next" : "Confirm"}
          </Button>
        </InlineStack>
      </DialogFooter>
    </form>
  );
}

interface ProjectOptionsProps {
  heading: string;
  projects: readonly ProjectSummary[];
  workspaceNames: Map<string, string> | undefined;
}

function ProjectOptions({
  heading,
  projects,
  workspaceNames,
}: ProjectOptionsProps) {
  return (
    <BlockStack gap="1">
      <Heading level={3}>{heading}</Heading>
      {projects.map((project) => (
        <ChoiceOption
          key={project.id}
          value={project.id}
          icon="Folder"
          label={project.name}
          detail={workspaceNames?.get(project.workspaceId)}
        />
      ))}
    </BlockStack>
  );
}

interface ChoiceOptionProps {
  value: string;
  icon: IconName;
  label: string;
  detail?: string;
}

function ChoiceOption({ value, icon, label, detail }: ChoiceOptionProps) {
  const id = useId();

  return (
    <Label
      htmlFor={id}
      className="w-full cursor-pointer rounded-md px-2 py-2 font-normal hover:bg-accent has-data-[state=checked]:bg-accent"
    >
      <RadioGroupItem id={id} value={value} />
      <Icon name={icon} size="xs" className="shrink-0" />
      <Text size="sm" className="flex-1 truncate">
        {label}
      </Text>
      {detail && (
        <Text size="xs" tone="subdued" className="truncate">
          {detail}
        </Text>
      )}
    </Label>
  );
}

interface CreateProjectStepProps {
  name: string;
  onNameChange: (name: string) => void;
  workspaceChoice: WorkspaceChoice;
  workspaceNotice: string | undefined;
  createLabel: string;
  onCreate: (workspaceId: string) => void;
  onBack: () => void;
}

function CreateProjectStep({
  name,
  onNameChange,
  workspaceChoice,
  workspaceNotice,
  createLabel,
  onCreate,
  onBack,
}: CreateProjectStepProps) {
  const workspace = workspaceChoice.selected;
  const canCreate = name.trim() !== "" && workspace !== undefined;

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate || !workspace) return;
    onCreate(workspace.id);
  };

  return (
    <form onSubmit={create}>
      <BlockStack gap="4">
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
        {workspaceNotice && (
          <Text size="sm" tone="subdued">
            {workspaceNotice}
          </Text>
        )}
        <DialogFooter className="w-full">
          <InlineStack gap="2" className="w-full" align="end">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              {...tracking("v2.run_view.tangent_destination.back")}
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={!canCreate}
              {...tracking("v2.run_view.tangent_destination.create", {
                workspace_changed: workspaceChoice.changedFromDefault,
              })}
            >
              {createLabel}
            </Button>
          </InlineStack>
        </DialogFooter>
      </BlockStack>
    </form>
  );
}
