import { getBackendSettings, selectBackendUrl } from "@/utils/backendSettings";
import { getStorage } from "@/utils/typedStorage";

import type { PipelineStorageService } from "./PipelineStorageService";

export interface PipelineCreationDestination {
  backendUrl: string | undefined;
}

export const remotePipelinesEnabled = () =>
  import.meta.env.VITE_REMOTE_PIPELINES === "true" &&
  import.meta.env.VITE_LOCAL_PIPELINES !== "true";

export const createsLocalPipelines = (backendConfigured = true) =>
  !remotePipelinesEnabled() ||
  !backendConfigured ||
  prefersBrowserPipelineStorage();

const STORAGE_PREFERENCE_KEY = "pipelines:save-in-browser";
const storagePreference = getStorage<
  typeof STORAGE_PREFERENCE_KEY,
  { [STORAGE_PREFERENCE_KEY]: boolean }
>();

export function prefersBrowserPipelineStorage(): boolean {
  return storagePreference.getItem(STORAGE_PREFERENCE_KEY) === true;
}

export function setBrowserPipelineStorage(enabled: boolean): void {
  storagePreference.setItem(STORAGE_PREFERENCE_KEY, enabled);
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
