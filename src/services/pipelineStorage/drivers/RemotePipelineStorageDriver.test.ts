import yaml from "js-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CloudPipeline,
  cloudPipelineToComponentSpec,
  deleteCloudPipeline,
  getCloudPipeline,
  getCloudPipelineAccount,
  listCloudPipelinePage,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import type { ComponentSpec } from "@/utils/componentSpec";

import { remotePipelineReference } from "../remotePipelineRecovery";
import { RemotePipelineStorageDriver } from "./RemotePipelineStorageDriver";

vi.mock("@/services/cloudPipelineService", () => ({
  cloudPipelineToComponentSpec: vi.fn(),
  deleteCloudPipeline: vi.fn(),
  getCloudPipeline: vi.fn(),
  getCloudPipelineAccount: vi.fn(),
  listCloudPipelinePage: vi.fn(),
  listCloudPipelines: vi.fn(),
  writeCloudPipeline: vi.fn(),
}));

const BACKEND = "https://backend.example.com";
const ACCOUNT = { id: "owner@example.com", permissions: ["read", "write"] };
const SPEC: ComponentSpec = {
  name: "Daily report",
  implementation: { graph: { tasks: {} } },
};
const CONTENT = yaml.dump(SPEC);

function pipeline(overrides: Partial<CloudPipeline> = {}): CloudPipeline {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    user_id: ACCOUNT.id,
    file_path: "pipeline-studio/document.yaml",
    pipeline_name: SPEC.name ?? null,
    created_at: "2026-09-17T12:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    current_version: "v1",
    versioning_mode: "full",
    version: "v1",
    version_created_at: "2026-09-18T12:00:00Z",
    root_pipeline_task: {
      componentRef: { spec: SPEC },
      arguments: { input: "saved value" },
    },
    pipeline_run_annotations: { "example.com/source": "preserved" },
    ...overrides,
  };
}

function driver() {
  return new RemotePipelineStorageDriver({ backendUrl: BACKEND });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCloudPipelineAccount).mockResolvedValue(ACCOUNT);
  vi.mocked(getCloudPipeline).mockResolvedValue(pipeline());
  vi.mocked(cloudPipelineToComponentSpec).mockReturnValue(SPEC);
  vi.mocked(listCloudPipelines).mockResolvedValue([pipeline()]);
  vi.mocked(writeCloudPipeline).mockImplementation(
    async ({ componentSpec, filePath }) =>
      pipeline({
        pipeline_name: componentSpec.name ?? null,
        file_path: filePath,
      }),
  );
});

describe("remote pipeline storage driver", () => {
  it("lists summaries with identity and permissions without loading each pipeline", async () => {
    const storage = driver();
    const other = pipeline({
      id: "20000000-0000-4000-8000-000000000002",
      user_id: "other@example.com",
    });
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline(), other],
      nextPageToken: "next",
      totalCount: 30,
    });
    const signal = new AbortController().signal;
    const page = await storage.listPage({
      pageToken: "cursor",
      pageSize: 10,
      signal,
    });
    expect(
      page.files.map(({ id, displayName, canEdit }) => ({
        id,
        displayName,
        canEdit,
      })),
    ).toEqual([
      {
        id: remotePipelineReference(BACKEND, pipeline().id),
        displayName: SPEC.name,
        canEdit: true,
      },
      {
        id: remotePipelineReference(BACKEND, other.id),
        displayName: SPEC.name,
        canEdit: false,
      },
    ]);
    expect(page.nextPageToken).toBe("next");
    expect(page.totalCount).toBe(30);
    expect(listCloudPipelinePage).toHaveBeenCalledExactlyOnceWith(
      { backendUrl: BACKEND, account: ACCOUNT, signal },
      { pageSize: 10, pageToken: "cursor" },
    );
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("returns content and saved metadata together", async () => {
    const storage = driver();
    const key = remotePipelineReference(BACKEND, pipeline().id);
    expect(await storage.read(key)).toEqual({
      content: CONTENT,
      descriptor: storage.describe(pipeline()),
    });
    expect(getCloudPipeline).toHaveBeenCalledExactlyOnceWith(pipeline().id, {
      backendUrl: BACKEND,
      account: ACCOUNT,
    });
  });

  it("saves with existing metadata and no extra reads", async () => {
    const storage = driver();
    const existing = storage.describe(pipeline());
    const saved = await storage.write(existing.storageKey, CONTENT, {
      existing,
    });
    expect(saved.id).toBe(existing.id);
    expect(writeCloudPipeline).toHaveBeenCalledExactlyOnceWith(
      {
        filePath: pipeline().file_path,
        componentSpec: SPEC,
        existingPipeline: pipeline(),
        sourcePipeline: undefined,
      },
      { backendUrl: BACKEND, account: ACCOUNT },
    );
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("preserves source metadata on first upload", async () => {
    const storage = driver();
    const source = storage.describe(pipeline());
    await storage.write("pipeline-studio/new.yaml", CONTENT, { source });
    expect(writeCloudPipeline).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        filePath: "pipeline-studio/new.yaml",
        existingPipeline: undefined,
        sourcePipeline: pipeline(),
      }),
      expect.anything(),
    );
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("renames display content without changing the saved path or identity", async () => {
    const storage = driver();
    const key = remotePipelineReference(BACKEND, pipeline().id);
    const renamed = await storage.rename(key, "Renamed");
    expect(renamed).toMatchObject({
      id: key,
      storageKey: key,
      displayName: "Renamed",
    });
    expect(writeCloudPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: pipeline().file_path,
        componentSpec: { ...SPEC, name: "Renamed" },
        existingPipeline: pipeline(),
      }),
      expect.anything(),
    );
  });

  it("deletes a known pipeline without a detail request", async () => {
    const storage = driver();
    const descriptor = storage.describe(pipeline());
    await storage.delete(descriptor.storageKey, descriptor);
    expect(deleteCloudPipeline).toHaveBeenCalledExactlyOnceWith(pipeline(), {
      backendUrl: BACKEND,
      account: ACCOUNT,
    });
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("rejects references for another backend", async () => {
    const storage = driver();
    const key = remotePipelineReference(
      "https://other.example.com",
      pipeline().id,
    );
    await expect(storage.read(key)).rejects.toThrow("different backend");
    await expect(storage.delete(key)).rejects.toThrow("different backend");
    expect(getCloudPipelineAccount).not.toHaveBeenCalled();
    expect(getCloudPipeline).not.toHaveBeenCalled();
    expect(deleteCloudPipeline).not.toHaveBeenCalled();
  });

  it("rejects mismatched metadata before writing or deleting", async () => {
    const storage = driver();
    const descriptor = storage.describe(pipeline());
    descriptor.pipeline = pipeline({
      id: "20000000-0000-4000-8000-000000000002",
    });
    await expect(
      storage.write(descriptor.storageKey, CONTENT, { existing: descriptor }),
    ).rejects.toThrow("does not match");
    await expect(
      storage.delete(descriptor.storageKey, descriptor),
    ).rejects.toThrow("does not match");
    expect(writeCloudPipeline).not.toHaveBeenCalled();
    expect(deleteCloudPipeline).not.toHaveBeenCalled();
  });

  it("retries account lookup after failure and then reuses it", async () => {
    const storage = driver();
    vi.mocked(getCloudPipelineAccount).mockRejectedValueOnce(
      new Error("Session expired"),
    );
    await expect(storage.list()).rejects.toThrow("Session expired");
    await storage.list();
    await storage.list();
    expect(getCloudPipelineAccount).toHaveBeenCalledTimes(2);
  });
});
