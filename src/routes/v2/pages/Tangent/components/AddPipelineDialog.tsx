import type { PipelineRunResponse } from "@/api/types.gen";
import { RunSection } from "@/components/Home/RunSection/RunSection";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DialogProps } from "@/providers/DialogProvider/types";
import { getDefaultRunPath } from "@/routes/runRoutes";
// TODO: extract PipelineFolders picker to shared or restructure via routing composition
import { PipelineFolders } from "@/routes/v2/pages/PipelineFolders/PipelineFolders";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import type { TangentResourceInput } from "@/services/tangentStorage/types";

export function AddPipelineDialog({
  close,
}: DialogProps<TangentResourceInput>) {
  function handleRunSelect(run: PipelineRunResponse) {
    const path = getDefaultRunPath(run.id);
    close({
      type: "run",
      url: `${window.location.origin}${path}`,
      name: run.pipeline_name ?? "Run",
      description: `Run #${run.id}`,
    });
  }

  function handlePipelineClick(pipeline: PipelineRef) {
    if (!pipeline.fileId) return;
    close({
      type: "pipeline",
      url: `pipeline://${pipeline.fileId}`,
      name: pipeline.name,
      description: "",
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a pipeline</DialogTitle>
        <DialogDescription className="hidden">
          Attach a pipeline run or a draft pipeline to this project.
        </DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="runs" className="w-full">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>
        <TabsContent value="runs">
          <BlockStack gap="4" className="h-[70vh] w-full overflow-y-auto">
            <RunSection hideFilters onRunSelect={handleRunSelect} />
          </BlockStack>
        </TabsContent>
        <TabsContent value="drafts">
          <BlockStack gap="4" className="h-[70vh] w-full overflow-y-auto">
            <PipelineFolders onPipelineClick={handlePipelineClick} />
          </BlockStack>
        </TabsContent>
      </Tabs>
    </>
  );
}
