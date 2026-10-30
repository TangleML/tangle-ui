import { useEffect } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import {
  type ProjectPipelineRef,
  remotePipelineResourceInput,
} from "@/services/projects/pipelineResource";
import {
  DescriptorTooLargeError,
  localPipelineResourceInput,
} from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";
import { useAddResourceToProject } from "@/services/projects/useProjectResources";
import { useReachableProjects } from "@/services/projects/useReachableProjects";

import { PickFromListDialog } from "./PickFromListDialog";

interface AddToProjectDialogProps {
  pipeline: ProjectPipelineRef;
  memberProjectIds: readonly string[];
  onOpenChange: (open: boolean) => void;
  onAdded: (projectId: string) => void;
}

async function resourceInputFor(
  pipeline: ProjectPipelineRef,
): Promise<CreateResourceInput> {
  return pipeline.source === "remote"
    ? remotePipelineResourceInput(pipeline.pipelineId, pipeline.name)
    : localPipelineResourceInput(await pointerTo(pipeline.name));
}

export function AddToProjectDialog({
  pipeline,
  memberProjectIds,
  onOpenChange,
  onAdded,
}: AddToProjectDialogProps) {
  const { projects, isPending, error } = useReachableProjects();
  const addResource = useAddResourceToProject();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  useEffect(() => {
    track("projects.add_to_project_dialog_impression");
  }, [track]);

  const alreadyIn = new Set(memberProjectIds);
  const items = projects.map((project) => ({
    id: project.id,
    label: project.name,
    alreadyAdded: alreadyIn.has(project.id),
  }));

  const add = async (projectId: string) => {
    let input;
    try {
      input = await resourceInputFor(pipeline);
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
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <PickFromListDialog
      title="Add to a project"
      helpText={`Runs of "${pipeline.name}" can then be attributed to the project you pick.`}
      noun="project"
      icon="Folder"
      items={items}
      error={error}
      isPending={isPending}
      isAdding={addResource.isPending}
      emptyTitle="No projects yet"
      emptyDescription="Create a project and it will show up here."
      selectTracking="projects.add_to_project_select"
      cancelTracking="projects.add_to_project_cancel"
      onPick={add}
      onClose={() => onOpenChange(false)}
    />
  );
}
