import { useEffect } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import {
  useLocalPipelineNames,
  useResolvedPointers,
} from "@/services/localPipelines/useLocalPipelines";
import {
  DescriptorTooLargeError,
  localPipelinePointerOf,
  localPipelineResourceInput,
} from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { PickFromListDialog } from "./PickFromListDialog";

interface AddPipelineDialogProps {
  projectId: string;
  resources: ProjectResourceSummary[];
  onOpenChange: (open: boolean) => void;
}

export function AddPipelineDialog({
  projectId,
  resources,
  onOpenChange,
}: AddPipelineDialogProps) {
  const { data: names, isPending, error } = useLocalPipelineNames();
  const createResource = useCreateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const pointers = resources
    .map((resource) => localPipelinePointerOf(resource))
    .filter((pointer) => pointer !== undefined);
  const { data: resolved } = useResolvedPointers(pointers);

  /**
   * A pointer records the name a pipeline had when it was added, so a renamed
   * pipeline is listed here under a name no pointer mentions. Matching what
   * each pointer resolves to as well is what stops it being added twice.
   */
  const alreadyAdded = new Set([
    ...pointers.map((pointer) => pointer.localName),
    ...Object.values(resolved ?? {}).filter((name) => name !== null),
  ]);

  useEffect(() => {
    track("projects.add_pipeline_dialog_impression");
  }, [track]);

  const items = names?.map((name) => ({
    id: name,
    label: name,
    alreadyAdded: alreadyAdded.has(name),
  }));

  const add = async (name: string) => {
    let input;
    try {
      input = localPipelineResourceInput(await pointerTo(name));
    } catch (problem) {
      notify(
        problem instanceof DescriptorTooLargeError
          ? problem.message
          : "Could not add that pipeline",
        "error",
      );
      return;
    }

    createResource.mutate(input, {
      onSuccess: () => {
        track("projects.add_pipeline_completed");
        notify("Pipeline added", "success");
        onOpenChange(false);
      },
    });
  };

  return (
    <PickFromListDialog
      title="Add a pipeline"
      helpText="Pipelines are stored in this browser, so a project can name one but cannot share it."
      noun="pipeline"
      icon="GitBranch"
      items={items}
      error={error}
      isPending={isPending}
      isAdding={createResource.isPending}
      emptyTitle="No pipelines in this browser"
      emptyDescription="Build a pipeline in the editor and it will show up here."
      selectTracking="projects.add_pipeline_select"
      cancelTracking="projects.add_pipeline_cancel"
      onPick={add}
      onClose={() => onOpenChange(false)}
    />
  );
}
