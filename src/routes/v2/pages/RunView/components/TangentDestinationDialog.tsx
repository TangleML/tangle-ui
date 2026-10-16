import { type FormEvent, useState } from "react";

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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { TangentDestination } from "@/routes/v2/pages/RunView/hooks/useRunTangentHandoff";
import type { ProjectSummary } from "@/services/projects/types";
import { useReachableProjects } from "@/services/projects/useReachableProjects";
import { useWorkspaceChoice } from "@/services/projects/useWorkspaceChoice";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { tracking } from "@/utils/tracking";

const NEW_PROJECT = "new-project";

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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const [name, setName] = useState(newProjectName);
  const reachable = useReachableProjects();
  const {
    data: workspaces,
    isPending: isWorkspacesPending,
    error: workspacesError,
  } = useWorkspaces();
  const workspaceChoice = useWorkspaceChoice(workspaces);

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
  const isNewProject = choice === NEW_PROJECT;
  const toggle = (option: string) =>
    setSelected(choice === option ? undefined : option);

  const trimmedName = name.trim();
  const workspace = workspaceChoice.selected;
  const canConfirm = isNewProject
    ? trimmedName !== "" && workspace !== undefined
    : choice !== undefined;
  const workspaceNotice = workspacesError
    ? `Could not load workspaces: ${workspacesError.message}`
    : !isWorkspacesPending && !workspace
      ? NO_WORKSPACE_AVAILABLE
      : undefined;

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (!canConfirm || !choice) return;
    if (!isNewProject) {
      onChoose({ kind: "existing", projectId: choice });
      return;
    }
    if (!workspace) return;
    onChoose({ kind: "new", workspaceId: workspace.id, name: trimmedName });
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

        <BlockStack gap="4" className="min-h-0 flex-1 overflow-y-auto">
          {attributedMatches.length > 0 && (
            <ProjectOptions
              heading="This run's projects"
              projects={attributedMatches}
              workspaceNames={workspaceNames}
              choice={choice}
              onToggle={toggle}
            />
          )}

          {otherMatches.length > 0 && (
            <ProjectOptions
              heading="Your projects"
              projects={otherMatches}
              workspaceNames={workspaceNames}
              choice={choice}
              onToggle={toggle}
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

        <form onSubmit={confirm}>
          <BlockStack gap="4">
            <OptionRow
              icon="Plus"
              label="New project"
              isSelected={isNewProject}
              onToggle={() => toggle(NEW_PROJECT)}
              trackingId="v2.run_view.tangent_destination.new_project"
            />

            {isNewProject && (
              <BlockStack gap="4" className="px-2">
                <BlockStack gap="2">
                  <Label htmlFor="tangent-destination-name">Name</Label>
                  <Input
                    id="tangent-destination-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoFocus
                  />
                </BlockStack>
                <WorkspaceField choice={workspaceChoice} />
                {workspaceNotice && (
                  <Text size="sm" tone="subdued">
                    {workspaceNotice}
                  </Text>
                )}
              </BlockStack>
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
                  disabled={!canConfirm}
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

interface ProjectOptionsProps {
  heading: string;
  projects: readonly ProjectSummary[];
  workspaceNames: Map<string, string> | undefined;
  choice: string | undefined;
  onToggle: (projectId: string) => void;
}

function ProjectOptions({
  heading,
  projects,
  workspaceNames,
  choice,
  onToggle,
}: ProjectOptionsProps) {
  return (
    <BlockStack gap="1">
      <Heading level={3}>{heading}</Heading>
      {projects.map((project) => (
        <OptionRow
          key={project.id}
          icon="Folder"
          label={project.name}
          detail={workspaceNames?.get(project.workspaceId)}
          isSelected={choice === project.id}
          onToggle={() => onToggle(project.id)}
          trackingId="v2.run_view.tangent_destination.select_project"
        />
      ))}
    </BlockStack>
  );
}

interface OptionRowProps {
  icon: IconName;
  label: string;
  detail?: string;
  isSelected: boolean;
  onToggle: () => void;
  trackingId: string;
}

function OptionRow({
  icon,
  label,
  detail,
  isSelected,
  onToggle,
  trackingId,
}: OptionRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isSelected}
      className={cn(
        "h-auto w-full justify-start py-2",
        isSelected && "bg-accent hover:bg-accent",
      )}
      onClick={onToggle}
      {...tracking(trackingId)}
    >
      <InlineStack gap="2" blockAlign="center" wrap="nowrap" fill>
        <Icon name={icon} size="xs" className="shrink-0" />
        <Text size="sm" className="flex-1 truncate text-left">
          {label}
        </Text>
        {detail && (
          <Text size="xs" tone="subdued" className="truncate">
            {detail}
          </Text>
        )}
      </InlineStack>
    </Button>
  );
}
