import type { RemotePipelineRef } from "@/services/pipelineStorage/types";
import type { ComponentSpec } from "@/utils/componentSpec";

export interface LocalPipelinePointer {
  localName: string;
  localId?: string;
}

export interface LocalPipeline {
  name: string;
  spec: ComponentSpec;
  yaml: string;
  modifiedAt?: Date;
  remote?: RemotePipelineRef;
}

export const pointerKey = (pointer: LocalPipelinePointer) =>
  `${pointer.localName}|${pointer.localId ?? ""}`;

export const LocalPipelinesQueryKeys = {
  All: () => ["local-pipelines"] as const,
  Names: () => ["local-pipelines", "names"] as const,
  Pointer: (pointer: LocalPipelinePointer) =>
    [
      "local-pipelines",
      "pointer",
      pointer.localName,
      pointer.localId ?? "",
    ] as const,
} as const;
