import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { usePipelineProjects } from "@/services/projects/usePipelineProjects";
import { useDeleteProjectResource } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

import { AddToProjectDialog } from "./AddToProjectDialog";
import { removalConsequence } from "./resourceEntities";
import { useRunProjectContext } from "./useRunProjectContext";

const NO_PROJECT = "none";

interface ProjectPickerProps {
  pipelineName: string | undefined;
}

export function ProjectPicker({ pipelineName }: ProjectPickerProps) {
  const { enabled, projectId, projectName, setProjectId } =
    useRunProjectContext();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { memberships, isPending } = usePipelineProjects(pipelineName, {
    enabled: open,
  });
  const removeResource = useDeleteProjectResource(projectId ?? "");
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  if (!enabled) {
    return null;
  }

  const current = memberships.find(
    (membership) => membership.project.id === projectId,
  );

  /**
   * A project can be the run context without holding the pipeline — the id
   * arrives in the URL and membership is never checked — so the chosen one is
   * listed whether or not it is a member, or the picker would read as though
   * nothing were chosen.
   */
  const listed = memberships.map(({ project }) => ({
    id: project.id,
    name: project.name,
  }));
  if (projectId && !current) {
    listed.unshift({ id: projectId, name: projectName ?? "Current project" });
  }

  const label = projectName ?? (projectId ? "Project" : "No project");

  const handleRemove = async () => {
    if (!current) return;

    const confirmed = await triggerConfirmation({
      title: `Remove "${current.resource.name ?? pipelineName}" from "${current.project.name}"?`,
      description: removalConsequence(current.resource),
    });
    if (!confirmed) return;

    removeResource.mutate(current.resource.id, {
      onSuccess: () => {
        track("projects.picker_remove_completed");
        notify("Removed from project", "success");
        setProjectId(undefined);
      },
    });
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Badge
            asChild
            size="sm"
            variant="secondary"
            className="max-w-48 gap-1.5"
          >
            <button
              type="button"
              aria-label={`Project for runs: ${label}`}
              title={`Project for runs: ${label}`}
              className="cursor-pointer hover:bg-secondary/80"
              {...tracking("projects.picker_open")}
            >
              <Icon name="Folder" size="xs" aria-hidden="true" />
              <Text size="xs" className="truncate">
                {label}
              </Text>
              <Icon name="ChevronDown" size="xs" aria-hidden="true" />
            </button>
          </Badge>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="max-w-72 min-w-56">
          <DropdownMenuLabel>Runs go to</DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={projectId ?? NO_PROJECT}
            onValueChange={(value) =>
              setProjectId(value === NO_PROJECT ? undefined : value)
            }
          >
            <DropdownMenuRadioItem value={NO_PROJECT}>
              No project
            </DropdownMenuRadioItem>
            {listed.map((project) => (
              <DropdownMenuRadioItem key={project.id} value={project.id}>
                <span className="truncate">{project.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          {isPending && (
            <InlineStack gap="2" blockAlign="center" className="px-2 py-1.5">
              <Spinner />
              <Text size="xs" tone="subdued">
                Looking for projects...
              </Text>
            </InlineStack>
          )}

          {pipelineName && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setAddOpen(true)}
                {...tracking("projects.picker_add_open")}
              >
                <Icon name="FolderPlus" size="sm" />
                Add to a project...
              </DropdownMenuItem>
              {current && (
                <DropdownMenuItem
                  onSelect={() => void handleRemove()}
                  {...tracking("projects.picker_remove_open")}
                >
                  <Icon name="FolderMinus" size="sm" />
                  <span className="truncate">
                    {`Remove from ${current.project.name}`}
                  </span>
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {addOpen && pipelineName && (
        <AddToProjectDialog
          pipelineName={pipelineName}
          memberProjectIds={memberships.map(
            (membership) => membership.project.id,
          )}
          open
          onOpenChange={setAddOpen}
          onAdded={setProjectId}
        />
      )}

      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
    </>
  );
}
