import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import type { DialogConfig } from "@/providers/DialogProvider/types";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddPipelineDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineDialog";
import { AddPipelineRunDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineRunDialog";
import type { CreateResourceInput } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

interface AddResourceButtonProps {
  projectId: string;
}

type ResourceDialogComponent = DialogConfig<CreateResourceInput>["component"];

export function AddResourceButton({ projectId }: AddResourceButtonProps) {
  const { open } = useDialog();
  const { mutate: createResource, isPending } =
    useCreateProjectResource(projectId);

  async function openResourceDialog(
    component: ResourceDialogComponent,
    routeKey: string,
  ) {
    const result = await open<CreateResourceInput>({
      component,
      routeKey,
      size: "full",
    }).catch(convertCancelErrorTo(undefined));

    if (!result) return;
    createResource(result);
  }

  function handleAddPipeline() {
    void openResourceDialog(AddPipelineDialog, "add-pipeline");
  }

  function handleAddPipelineRun() {
    void openResourceDialog(AddPipelineRunDialog, "add-pipeline-run");
  }

  return (
    <InlineStack fill>
      <Button
        variant="outline"
        className="flex-1 gap-2 rounded-r-none border-r-0"
        disabled={isPending}
        onClick={handleAddPipeline}
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
          >
            <Icon name="ChevronDown" size="sm" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleAddPipeline}>
            <Icon name="Plus" size="sm" />
            Add a pipeline
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAddPipelineRun}>
            <Icon name="Play" size="sm" />
            Add pipeline run
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </InlineStack>
  );
}
