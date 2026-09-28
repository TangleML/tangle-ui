import type { PipelineRunResponse } from "@/api/types.gen";
import { RunSection } from "@/components/Home/RunSection/RunSection";
import { PipelineRunFiltersBar } from "@/components/shared/PipelineRunFiltersBar/PipelineRunFiltersBar";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import type { DialogProps } from "@/providers/DialogProvider/types";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { pipelineRunResourceExtraData } from "@/routes/v2/pages/Tangent/workarea/resourceExtraData";
import type { CreateResourceInput } from "@/services/projects/types";

export function AddPipelineRunDialog({
  close,
}: DialogProps<CreateResourceInput>) {
  function handleRunClick(run: PipelineRunResponse) {
    const runId = `${run.id}`;
    const url = new URL(getDefaultRunPath(runId), window.location.origin).href;
    close({
      entity: "document",
      name: run.pipeline_name ?? `Run ${runId}`,
      extraData: pipelineRunResourceExtraData(runId, url),
      // required by api
      payload: {},
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a pipeline run</DialogTitle>
        <DialogDescription className="sr-only">
          Attach a pipeline run to this project.
        </DialogDescription>
      </DialogHeader>
      <BlockStack gap="4" className="h-[70vh] w-full overflow-y-auto">
        <PipelineRunFiltersBar />
        <RunSection hideFilters onRunClick={handleRunClick} />
      </BlockStack>
    </>
  );
}
