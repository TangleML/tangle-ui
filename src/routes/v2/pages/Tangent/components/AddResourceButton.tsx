import { useState } from "react";

import { AddPipelineDialog } from "@/components/Project/AddPipelineDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import type { DialogConfig } from "@/providers/DialogProvider/types";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddDocumentDialog } from "@/routes/v2/pages/Tangent/components/AddDocumentDialog";
import { AddPipelineRunDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineRunDialog";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

interface AddResourceButtonProps {
  projectId: string;
  resources: ProjectResourceSummary[];
}

type ResourceDialogComponent = DialogConfig<CreateResourceInput>["component"];

function identityOf(metadata: Record<string, unknown> | null | undefined) {
  const identity = metadata?.identity;
  return typeof identity === "string" ? identity : undefined;
}

function alreadyHolds(
  resources: ProjectResourceSummary[],
  pick: CreateResourceInput,
): boolean {
  const metadata = pick.metadata ?? null;

  const identity = identityOf(metadata);
  return (
    identity !== undefined &&
    resources.some((resource) => identityOf(resource.metadata) === identity)
  );
}

export function AddResourceButton({
  projectId,
  resources,
}: AddResourceButtonProps) {
  const [pipelinePickerOpen, setPipelinePickerOpen] = useState(false);
  const { open } = useDialog();
  const notify = useToastNotification();
  const { mutate: createResource, isPending } =
    useCreateProjectResource(projectId);

  async function openResourceDialog(
    component: ResourceDialogComponent,
    routeKey: string,
    size: DialogConfig<CreateResourceInput>["size"] = "full",
  ) {
    const result = await open<CreateResourceInput>({
      component,
      routeKey,
      size,
    }).catch(convertCancelErrorTo(undefined));

    if (!result) return;

    if (alreadyHolds(resources, result)) {
      notify(`${result.name ?? "That"} is already in this project`, "info");
      return;
    }

    createResource(result);
  }

  function handleAddPipeline() {
    setPipelinePickerOpen(true);
  }

  function handleAddPipelineRun() {
    void openResourceDialog(AddPipelineRunDialog, "add-pipeline-run");
  }

  // The pipeline and run pickers are browsers and want the room; two fields
  // and a pair of buttons do not.
  function handleAddDocument() {
    void openResourceDialog(AddDocumentDialog, "add-document", "md");
  }

  return (
    <>
      {pipelinePickerOpen && (
        <AddPipelineDialog
          projectId={projectId}
          resources={resources}
          onOpenChange={setPipelinePickerOpen}
        />
      )}
      <InlineStack fill>
        <Button
          variant="outline"
          className="flex-1 gap-2 rounded-r-none border-r-0"
          disabled={isPending}
          onClick={handleAddPipeline}
          {...tracking("projects.add_pipeline_open")}
        >
          <Icon name="Plus" size="xs" />
          Add a pipeline
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="rounded-l-none px-1.5"
              disabled={isPending}
              aria-label="More resource types"
              {...tracking("projects.add_resource_menu")}
            >
              <Icon name="ChevronDown" size="sm" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleAddPipeline}
              {...tracking("projects.add_pipeline_open")}
            >
              <Icon name="Plus" size="sm" />
              Add a pipeline
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleAddPipelineRun}
              {...tracking("projects.add_pipeline_run_open")}
            >
              <Icon name="Play" size="sm" />
              Add pipeline run
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleAddDocument}
              {...tracking("projects.add_document_open")}
            >
              <Icon name="FileText" size="sm" />
              Add a document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </InlineStack>
    </>
  );
}
