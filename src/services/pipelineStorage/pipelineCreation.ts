import { getBackendSettings, selectBackendUrl } from "@/utils/backendSettings";
import type { ComponentSpec } from "@/utils/componentSpec";

import type { PipelineStorageService } from "./PipelineStorageService";

export interface PipelineCreationDestination {
  backendUrl: string;
}

export async function getPipelineCreationBackendUrl(): Promise<string> {
  const { useEnv, useRelativePath, userBackendUrl } =
    await getBackendSettings();
  const url = selectBackendUrl(useEnv, useRelativePath, userBackendUrl);
  if (!url.trim()) {
    throw new Error("Configure a backend before saving a pipeline.");
  }
  return url;
}

export async function createPipelineFromSpec(
  storage: PipelineStorageService,
  name: string,
  spec: ComponentSpec,
  destination?: PipelineCreationDestination,
) {
  const backendUrl =
    destination?.backendUrl ?? (await getPipelineCreationBackendUrl());
  return storage.createRemotePipeline(backendUrl, name, spec);
}
