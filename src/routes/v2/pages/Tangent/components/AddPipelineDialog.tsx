import { useState } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBackend } from "@/providers/BackendProvider";
import type { DialogProps } from "@/providers/DialogProvider/types";
import { PipelineFolders } from "@/routes/v2/pages/PipelineFolders/PipelineFolders";
import { useLocalPipelineNames } from "@/services/localPipelines/useLocalPipelines";
import { remotePipelinesEnabled } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import { localPipelineResourceInput } from "@/services/projects/resourceDescriptor";
import type { CreateResourceInput } from "@/services/projects/types";

import { RemotePipelinePicker } from "./RemotePipelinePicker";

type PipelineSource = "remote" | "local";

export function AddPipelineDialog({ close }: DialogProps<CreateResourceInput>) {
  const { ready, configured } = useBackend();
  const { data: localNames, isPending: localNamesPending } =
    useLocalPipelineNames();
  const [source, setSource] = useState<PipelineSource>("remote");

  const remoteEnabled = remotePipelinesEnabled();
  const offersRemote = remoteEnabled && configured;
  const offersLocal = !offersRemote || localNames?.length !== 0;
  const isLoading =
    remoteEnabled && (!ready || (configured && localNamesPending));

  function chooseLocal(pipeline: PipelineRef) {
    if (!pipeline.fileId) return;
    close(
      localPipelineResourceInput({
        localName: pipeline.name,
        localId: pipeline.fileId,
      }),
    );
  }

  function changeSource(value: string) {
    if (value === "remote" || value === "local") setSource(value);
  }

  const remotePipelines = <RemotePipelinePicker onChoose={close} />;
  const localPipelines = <PipelineFolders onPipelineClick={chooseLocal} />;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a pipeline</DialogTitle>
        <DialogDescription className="sr-only">
          Attach a pipeline to this project.
        </DialogDescription>
      </DialogHeader>
      {isLoading ? (
        <BlockStack className="h-[70vh] w-full">
          <LoadingScreen message="Loading pipelines…" />
        </BlockStack>
      ) : offersRemote && offersLocal ? (
        <Tabs
          value={source}
          onValueChange={changeSource}
          className="h-[70vh] w-full gap-4"
        >
          <TabsList aria-label="Pipeline storage">
            <TabsTrigger value="remote">Remote Pipelines</TabsTrigger>
            <TabsTrigger value="local">Local Pipelines</TabsTrigger>
          </TabsList>
          <TabsContent value="remote" className="min-h-0">
            {remotePipelines}
          </TabsContent>
          <TabsContent value="local" className="min-h-0 overflow-y-auto">
            {localPipelines}
          </TabsContent>
        </Tabs>
      ) : offersRemote ? (
        <BlockStack className="h-[70vh] w-full">{remotePipelines}</BlockStack>
      ) : (
        <BlockStack className="h-[70vh] w-full overflow-y-auto">
          {localPipelines}
        </BlockStack>
      )}
    </>
  );
}
