import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import type { DialogProps } from "@/providers/DialogProvider/types";
import { PipelineFolders } from "@/routes/v2/pages/PipelineFolders/PipelineFolders";
import type { AttachResourceInput } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import type { PipelineRef } from "@/services/pipelineStorage/types";

export function AddPipelineDialog({ close }: DialogProps<AttachResourceInput>) {
  function handlePipelineClick(pipeline: PipelineRef) {
    if (!pipeline.fileId) return;
    close({
      entity: "pipeline",
      entityId: pipeline.fileId,
      name: pipeline.name,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a pipeline</DialogTitle>
        <DialogDescription className="sr-only">
          Attach a draft pipeline to this project.
        </DialogDescription>
      </DialogHeader>
      <BlockStack gap="4" className="h-[70vh] w-full overflow-y-auto">
        <PipelineFolders onPipelineClick={handlePipelineClick} />
      </BlockStack>
    </>
  );
}
