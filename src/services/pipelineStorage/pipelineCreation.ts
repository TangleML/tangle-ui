import { getBackendSettings, selectBackendUrl } from "@/utils/backendSettings";

import type { PipelineStorageService } from "./PipelineStorageService";

export interface PipelineCreationDestination {
  backendUrl: string | undefined;
}

export const createsLocalPipelines = (backendConfigured = true) =>
  import.meta.env.VITE_LOCAL_PIPELINES === "true" ||
  !backendConfigured ||
  prefersBrowserPipelineStorage();

const STORAGE_PREFERENCE_KEY = "pipelines:save-in-browser";

export function prefersBrowserPipelineStorage(): boolean {
  return localStorage.getItem(STORAGE_PREFERENCE_KEY) === "true";
}

export function setBrowserPipelineStorage(enabled: boolean): void {
  localStorage.setItem(STORAGE_PREFERENCE_KEY, String(enabled));
}

export async function getPipelineCreationBackendUrl(): Promise<
  string | undefined
> {
  if (createsLocalPipelines()) return undefined;
  const { useEnv, useRelativePath, userBackendUrl } =
    await getBackendSettings();
  const url = selectBackendUrl(useEnv, useRelativePath, userBackendUrl);
  return createsLocalPipelines(Boolean(url.trim())) ? undefined : url;
}

export async function createPipelineFromContent(
  storage: PipelineStorageService,
  name: string,
  content: string,
  destination?: PipelineCreationDestination,
) {
  const backendUrl = destination
    ? destination.backendUrl
    : await getPipelineCreationBackendUrl();
  return backendUrl
    ? storage.createRemotePipeline(backendUrl, name, content)
    : storage.rootFolder.addFile(name, content);
}
