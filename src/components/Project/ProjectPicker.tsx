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
import { usePipelineProjects } from "@/services/projects/usePipelineProjects";
import { tracking } from "@/utils/tracking";

import { AddToProjectDialog } from "./AddToProjectDialog";
import { NO_PROJECT, projectOptions } from "./projectOptions";
import { useConfirmedResourceRemoval } from "./useConfirmedResourceRemoval";
import { useRunProjectContext } from "./useRunProjectContext";

interface ProjectPickerProps {
  pipelineName: string | undefined;
}

export function ProjectPicker({ pipelineName }: ProjectPickerProps) {
  const { enabled, projectId, projectName, setProjectId } =
    useRunProjectContext();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { memberships, isPending, error } = usePipelineProjects(pipelineName, {
    enabled: open,
  });
  const { confirmAndRemove, confirmation: confirmationProps } =
    useConfirmedResourceRemoval({
      projectId: projectId ?? "",
      trackingEvent: "projects.picker_remove_completed",
      onRemoved: () => setProjectId(undefined),
    });

  if (!enabled) {
    return null;
  }

  const current = memberships.find(
    (membership) => membership.project.id === projectId,
  );

  const listed = projectOptions(memberships, projectId, projectName);

  const label = projectName ?? (projectId ? "Project" : "No project");

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

          {error && (
            <InlineStack gap="2" blockAlign="center" className="px-2 py-1.5">
              <Icon name="CircleAlert" size="xs" aria-hidden="true" />
              <Text size="xs" tone="critical">
                {`Could not look up this pipeline's projects.`}
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
                  onSelect={() =>
                    current && void confirmAndRemove(current.resource)
                  }
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
          onOpenChange={setAddOpen}
          onAdded={setProjectId}
        />
      )}

      <ConfirmationDialog {...confirmationProps} />
    </>
  );
}
