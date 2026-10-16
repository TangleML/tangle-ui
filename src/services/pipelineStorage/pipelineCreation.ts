import { API_URL } from "@/utils/constants";
import {
  getUseEnv,
  getUserBackendUrl,
  getUseRelativePath,
} from "@/utils/localforage";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { RemotePipelineStorageDriver } from "./drivers/RemotePipelineStorageDriver";
import type { PipelineStorageService } from "./PipelineStorageService";
import type { RemotePipelineRef } from "./types";

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
