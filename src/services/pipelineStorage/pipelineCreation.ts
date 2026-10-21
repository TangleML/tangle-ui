import { getBackendSettings, selectBackendUrl } from "@/utils/backendSettings";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { RemotePipelineStorageDriver } from "./drivers/RemotePipelineStorageDriver";
import type { PipelineStorageService } from "./PipelineStorageService";
import type { RemotePipelineRef } from "./types";

export const createsLocalPipelines = () =>
  import.meta.env.VITE_LOCAL_PIPELINES === "true" ||
  prefersBrowserPipelineStorage();

const STORAGE_PREFERENCE_KEY = "pipelines:save-in-browser";

export function prefersBrowserPipelineStorage(): boolean {
  return localStorage.getItem(STORAGE_PREFERENCE_KEY) === "true";
}

export function setBrowserPipelineStorage(enabled: boolean): void {
  localStorage.setItem(STORAGE_PREFERENCE_KEY, String(enabled));
}

export async function getPipelineCreationBackendUrl(): Promise<string> {
  const { useEnv, useRelativePath, userBackendUrl } =
    await getBackendSettings();
  const url = selectBackendUrl(useEnv, useRelativePath, userBackendUrl);
  if (!url.trim()) {
    throw new Error("Configure a backend in Settings to create pipelines.");
  }
  return url;
}

/** Imports and copies already contain content, so they can be saved immediately. */
export async function createPipelineFromContent(
  storage: PipelineStorageService,
  name: string,
  content: string,
) {
  return createsLocalPipelines()
    ? storage.rootFolder.addFile(name, content)
    : storage.createRemotePipeline(
        await getPipelineCreationBackendUrl(),
        name,
        content,
      );
}

export async function saveNewRemotePipeline(
  name: string,
  content: string,
): Promise<RemotePipelineRef> {
  const backendUrl = await getPipelineCreationBackendUrl();
  const driver = await RemotePipelineStorageDriver.create(
    backendUrl,
    name,
    content,
  );
  emitUserPipelineWritten();
  return { source: "remote", backendUrl, pipelineId: driver.pipelineId };
}
