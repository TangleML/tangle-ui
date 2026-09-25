import { useEffect, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import {
  DescriptorTooLargeError,
  localPipelineResourceInput,
} from "@/services/projects/resourceDescriptor";
import { useAddResourceToProject } from "@/services/projects/useProjectResources";
import { useProjects } from "@/services/projects/useProjects";
import { tracking } from "@/utils/tracking";

interface AddToProjectDialogProps {
  pipelineName: string;
  memberProjectIds: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (projectId: string) => void;
}

export function AddToProjectDialog({
  pipelineName,
  memberProjectIds,
  open,
  onOpenChange,
  onAdded,
}: AddToProjectDialogProps) {
  const [query, setQuery] = useState("");
  const { data, isPending, error } = useProjects({});
  const addResource = useAddResourceToProject();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const projects = data?.items ?? [];
  const alreadyIn = new Set(memberProjectIds);

  useEffect(() => {
    if (open) {
      track("projects.add_to_project_dialog_impression");
    }
  }, [open, track]);

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };

  const add = async (projectId: string) => {
    let input;
    try {
      input = localPipelineResourceInput(await pointerTo(pipelineName));
    } catch (problem) {
      notify(
        problem instanceof DescriptorTooLargeError
          ? problem.message
          : "Could not add this pipeline",
        "error",
      );
      return;
    }

    addResource.mutate(
      { projectId, input },
      {
        onSuccess: () => {
          track("projects.add_to_project_completed");
          notify("Added to project", "success");
          onAdded(projectId);
          close();
        },
      },
    );
  };

  const matches = projects.filter((project) =>
    project.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="flex max-h-[80vh] flex-col">
        <DialogHeader>
          <DialogTitle>Add to a project</DialogTitle>
        </DialogHeader>

        <BlockStack gap="4" className="min-h-0">
          <Text size="sm" tone="subdued">
            {`Runs of "${pipelineName}" can then be attributed to the project you pick.`}
          </Text>

          {projects.length > 0 && (
            <div className="relative">
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

          {isPending && (
            <InlineStack gap="2" blockAlign="center">
              <Spinner /> Loading...
            </InlineStack>
          )}

          {error && (
            <InfoBox title="Error loading projects" variant="error">
              {error.message}
            </InfoBox>
          )}

          {data && projects.length === 0 && (
            <EmptyState
              icon="Folder"
              placement="start"
              title="No projects yet"
              description="Create a project and it will show up here."
            />
          )}

          {projects.length > 0 && matches.length === 0 && (
            <Text size="sm" tone="subdued">
              No projects match that.
            </Text>
          )}

          <BlockStack gap="1" className="min-h-0 flex-1 overflow-y-auto">
            {matches.map((project) => (
              <Button
                key={project.id}
                variant="ghost"
                className="h-auto w-full justify-start py-2"
                disabled={alreadyIn.has(project.id) || addResource.isPending}
                onClick={() => add(project.id)}
                {...tracking("projects.add_to_project_select")}
              >
                <InlineStack
                  gap="2"
                  blockAlign="center"
                  wrap="nowrap"
                  className="w-full"
                >
                  <Icon name="Folder" size="xs" className="shrink-0" />
                  <Text size="sm" className="flex-1 truncate text-left">
                    {project.name}
                  </Text>
                  {alreadyIn.has(project.id) && (
                    <Text size="xs" tone="subdued">
                      Added
                    </Text>
                  )}
                </InlineStack>
              </Button>
            ))}
          </BlockStack>
        </BlockStack>

        <DialogFooter className="w-full">
          <InlineStack gap="2" className="w-full" align="end">
            <Button
              variant="outline"
              onClick={close}
              {...tracking("projects.add_to_project_cancel")}
            >
              Cancel
            </Button>
          </InlineStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
