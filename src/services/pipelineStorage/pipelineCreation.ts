import { API_URL } from "@/utils/constants";
import {
  getUseEnv,
  getUserBackendUrl,
  getUseRelativePath,
} from "@/utils/localforage";

import type { PipelineStorageService } from "./PipelineStorageService";

export const createsLocalPipelines = () =>
  import.meta.env.VITE_LOCAL_PIPELINES === "true";

/** Match the backend selection used by BackendProvider, including same-origin deployments. */
export async function getPipelineCreationBackendUrl(): Promise<string> {
  const [useEnv, useRelativePath, userUrl] = await Promise.all([
    getUseEnv(),
    getUseRelativePath(),
    getUserBackendUrl(),
  ]);
  const url =
    useEnv && API_URL
      ? API_URL
      : useRelativePath && !API_URL
        ? window.location.origin
        : userUrl;
  if (!url.trim()) {
    throw new Error(
      "Configure a backend in Settings to create remote pipelines.",
    );
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
