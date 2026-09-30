import "fake-indexeddb/auto";

import { waitFor } from "@testing-library/react";
import yaml from "js-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CloudPipeline,
  getCloudPipeline,
  getCloudPipelineAccount,
  listCloudPipelinePage,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import type { ComponentSpec } from "@/utils/componentSpec";

import { pipelineStorageDb } from "./db";
import { PipelineStorageService } from "./PipelineStorageService";
import {
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "./remotePipelineRecovery";
import { ROOT_FOLDER_ID } from "./types";

vi.mock("@/services/cloudPipelineService", async (load) => ({
  ...(await load<typeof import("@/services/cloudPipelineService")>()),
  getCloudPipeline: vi.fn(),
  getCloudPipelineAccount: vi.fn(),
  listCloudPipelinePage: vi.fn(),
  listCloudPipelines: vi.fn(),
  writeCloudPipeline: vi.fn(),
}));
vi.mock("./migratePipelineReferences", () => ({
  migratePipelineReferences: vi.fn(),
}));
vi.mock("@/utils/componentStore", () => ({
  deleteComponentFileFromList: vi.fn(),
  getAllComponentFilesFromList: vi.fn(async () => new Map()),
  getComponentFileFromList: vi.fn(),
  renameComponentFileInList: vi.fn(),
  writeComponentToFileListFromText: vi.fn(),
}));

const ACCOUNT = "owner@example.com";
const BACKEND = "https://backend.example.com";
const SCOPE = JSON.stringify([BACKEND, ACCOUNT]);
const LOCAL_ID = "10000000-0000-4000-8000-000000000001";
const REMOTE_ID = "20000000-0000-4000-8000-000000000001";
const CLONE_ID = "20000000-0000-4000-8000-000000000002";
const NAME = "Daily report";
const SPEC: ComponentSpec = {
  name: NAME,
  implementation: { graph: { tasks: {} } },
};
const CONTENT = yaml.dump(SPEC);

function pipeline(overrides: Partial<CloudPipeline> = {}): CloudPipeline {
  return {
    id: REMOTE_ID,
    user_id: ACCOUNT,
    file_path: `pipeline-studio/${LOCAL_ID}.yaml`,
    pipeline_name: NAME,
    created_at: "2026-09-17T12:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    current_version: "abc123",
    versioning_mode: "disabled",
    version: "abc123",
    version_created_at: "2026-09-18T12:00:00Z",
    root_pipeline_task: { componentRef: { spec: SPEC } },
    pipeline_run_annotations: {},
    ...overrides,
  };
}

function service(scope = SCOPE) {
  return new PipelineStorageService({
    scope,
    connection: { backendUrl: BACKEND, authorizationToken: "token" },
  });
}

async function registeredLocal(storage: PipelineStorageService, name = NAME) {
  await pipelineStorageDb.pipeline_registry.put({
    id: LOCAL_ID,
    storageKey: name,
    folderId: ROOT_FOLDER_ID,
  });
  vi.spyOn(storage.rootFolder.driver, "read").mockResolvedValue(CONTENT);
  return storage.findPipelineById(LOCAL_ID);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await remotePipelineRecoveryDb.copies.clear();
  await pipelineStorageDb.pipeline_registry.clear();
  await pipelineStorageDb.folders.clear();
  vi.mocked(getCloudPipelineAccount).mockResolvedValue({
    id: ACCOUNT,
    permissions: ["read", "write"],
  });
  vi.mocked(getCloudPipeline).mockResolvedValue(pipeline());
  vi.mocked(listCloudPipelinePage).mockResolvedValue({ pipelines: [] });
  vi.mocked(listCloudPipelines).mockResolvedValue([]);
  vi.mocked(writeCloudPipeline).mockImplementation(
    async ({ filePath, componentSpec }) =>
      pipeline({
        file_path: filePath,
        pipeline_name: componentSpec.name ?? null,
        root_pipeline_task: { componentRef: { spec: componentSpec } },
      }),
  );
});

describe("pipeline identity compatibility", () => {
  it.each(["registered", "legacy"])(
    "opens a %s local UUID-shaped name before considering a remote ID",
    async (kind) => {
      const storage = service();
      if (kind === "registered") await registeredLocal(storage, REMOTE_ID);
      vi.spyOn(storage.rootFolder.driver, "hasKey").mockResolvedValue(true);

      const file = await storage.resolvePipelineByName(REMOTE_ID);

      expect(file?.storageKind).toBe("local");
      expect(file?.referenceId).toBe(REMOTE_ID);
      if (kind === "registered") expect(file?.id).toBe(LOCAL_ID);
      expect(getCloudPipeline).not.toHaveBeenCalled();
    },
  );

  it("resolves a registry UUID as its local file identity", async () => {
    const storage = service();
    const file = await registeredLocal(storage);

    expect(await storage.findPipelineById(LOCAL_ID)).toBe(file);
    expect(file.referenceId).toBe(NAME);
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("opens bare remote IDs and old scoped URLs with the same document identity", async () => {
    const storage = service();
    const file = await storage.resolvePipelineByName(REMOTE_ID);
    const reference = remotePipelineReference(BACKEND, REMOTE_ID);

    expect(file?.referenceId).toBe(reference);
    expect(await storage.resolvePipelineByName(reference)).toBe(file);
    expect(file?.remoteId).toBe(REMOTE_ID);
  });

  it("finds a published UUID-shaped local name by its original identity", async () => {
    const storage = service();
    const file = await registeredLocal(storage, LOCAL_ID);
    await storage.migratePipeline(file);

    expect(await storage.resolvePipelineByName(LOCAL_ID)).toBe(file);
    expect(file.id).toBe(LOCAL_ID);
    expect(file.remoteId).toBe(REMOTE_ID);
  });

  it("assigns one registry identity when two services discover a local file together", async () => {
    const first = service();
    const second = service();

    const [a, b] = await Promise.all([
      first.rootFolder.assignFile(NAME),
      second.rootFolder.assignFile(NAME),
    ]);

    expect(a.id).toBe(b.id);
    expect(await pipelineStorageDb.pipeline_registry.count()).toBe(1);
  });

  it("publishes through both previously opened local handles without replacing their IDs", async () => {
    const storage = service();
    const original = await storage.rootFolder.assignFile(NAME);
    const opened = await storage.findPipelineById(original.id);
    vi.spyOn(storage.rootFolder.driver, "read").mockResolvedValue(CONTENT);
    const localWrite = vi.spyOn(storage.rootFolder.driver, "write");

    expect(await storage.migratePipeline(original)).toBe(original);
    await original.write(
      yaml.dump({ ...SPEC, description: "Original handle" }),
    );
    await opened.write(
      yaml.dump({ ...SPEC, description: "Other open handle" }),
    );

    expect(original.id).toBe(opened.id);
    expect(original.remoteId).toBe(REMOTE_ID);
    expect(opened.remoteId).toBe(REMOTE_ID);
    expect(localWrite).not.toHaveBeenCalled();
    expect(writeCloudPipeline).toHaveBeenCalledTimes(3);
    expect(vi.mocked(writeCloudPipeline).mock.calls[2][0]).toMatchObject({
      componentSpec: { description: "Other open handle" },
      existingPipeline: { id: REMOTE_ID },
    });
  });
});

describe("draft and argument compatibility", () => {
  it("preserves a renamed unpublished draft's scope and upload identity", async () => {
    const storage = service();
    const file = await registeredLocal(storage);
    const renamed = "Renamed before upload";
    const content = yaml.dump({
      ...SPEC,
      name: renamed,
      description: "New draft",
    });
    await file.persistRecovery(CONTENT);
    const original = await remotePipelineRecoveryDb.copies.toArray();

    await file.rename(renamed);
    await file.persistRecovery(content);
    const reopened = await service().findPipelineById(file.id);

    expect(await reopened.read()).toBe(content);
    expect(reopened.displayName).toBe(renamed);
    expect(await remotePipelineRecoveryDb.copies.toArray()).toEqual([
      expect.objectContaining({
        key: original[0].key,
        scope: SCOPE,
        localStorageKey: renamed,
        content,
        filePath: `pipeline-studio/${LOCAL_ID}.yaml`,
      }),
    ]);
    expect(writeCloudPipeline).not.toHaveBeenCalled();
  });

  it("retains a newer recovery draft staged while a clean remote open is loading", async () => {
    const first = service();
    const file = await first.findPipelineById(REMOTE_ID);
    await file.read();
    await file.write(CONTENT);
    const content = yaml.dump({
      ...SPEC,
      description: "Edit during server read",
    });
    const reading = deferred<CloudPipeline>();
    vi.mocked(getCloudPipeline).mockReturnValueOnce(reading.promise);

    const second = service()
      .findPipelineById(REMOTE_ID)
      .then(async (opened) => {
        await opened.read();
        return opened;
      });
    await waitFor(() => expect(getCloudPipeline).toHaveBeenCalledTimes(2));
    await file.persistRecovery(content);
    reading.resolve(pipeline());
    const reopened = await second;

    expect(await reopened.read()).toBe(content);
    expect(reopened.saveError).toBe("Not saved to server");
    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
  });

  it("retains saved dynamic arguments and passes the full source when cloning", async () => {
    const spec: ComponentSpec = {
      ...SPEC,
      inputs: [{ name: "credential" }, { name: "dataset" }],
    };
    const dynamicArguments = {
      credential: { dynamicData: { secret: { name: "service-key" } } },
      dataset: { dynamicData: { system: { key: "source-dataset" } } },
    };
    const source = pipeline({
      root_pipeline_task: {
        componentRef: { spec },
        arguments: dynamicArguments,
      },
      pipeline_run_annotations: { purpose: "nightly" },
    });
    vi.mocked(getCloudPipeline).mockResolvedValue(source);
    vi.mocked(writeCloudPipeline).mockResolvedValueOnce(
      pipeline({ ...source, id: CLONE_ID, file_path: "clone.yaml" }),
    );
    const storage = service();
    const file = await storage.findPipelineById(REMOTE_ID);
    await file.read();

    expect(file.savedTaskArguments).toEqual(dynamicArguments);
    const clone = await storage.createPipeline("Clone", yaml.dump(spec), file);

    expect(clone.id).not.toBe(file.id);
    expect(clone.remoteId).toBe(CLONE_ID);
    expect(file.remoteId).toBe(REMOTE_ID);
    expect(vi.mocked(writeCloudPipeline).mock.calls[0][0]).toMatchObject({
      sourcePipeline: source,
    });
    expect(clone.savedTaskArguments).toEqual(dynamicArguments);
  });
});
