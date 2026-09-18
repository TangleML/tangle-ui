import "fake-indexeddb/auto";

import yaml from "js-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CloudPipeline,
  cloudPipelineToComponentSpec,
  getCloudPipeline,
  getCloudPipelineAccount,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import { pipelineStorageDb } from "@/services/pipelineStorage/db";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import {
  type RemotePipelineRecovery,
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "@/services/pipelineStorage/remotePipelineRecovery";
import { ROOT_FOLDER_ID } from "@/services/pipelineStorage/types";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getAllComponentFilesFromList } from "@/utils/componentStore";

vi.mock("@/services/cloudPipelineService", () => ({
  cloudPipelineToComponentSpec: vi.fn(),
  deleteCloudPipeline: vi.fn(),
  getCloudPipeline: vi.fn(),
  getCloudPipelineAccount: vi.fn(),
  listCloudPipelines: vi.fn(),
  writeCloudPipeline: vi.fn(),
}));
vi.mock("@/services/pipelineStorage/migratePipelineReferences", () => ({
  migratePipelineReferences: vi.fn(),
}));
vi.mock("@/utils/componentStore", () => ({
  deleteComponentFileFromList: vi.fn(),
  getAllComponentFilesFromList: vi.fn(),
  getComponentFileFromList: vi.fn(),
  renameComponentFileInList: vi.fn(),
  writeComponentToFileListFromText: vi.fn(),
}));

const ACCOUNT = "owner@example.com";
const BACKEND = "https://backend.example.com";
const SCOPE = JSON.stringify([BACKEND, ACCOUNT]);
const LOCAL_ID = "10000000-0000-4000-8000-000000000001";
const CLOUD_ID = "20000000-0000-4000-8000-000000000001";
const NAME = "Daily report";
const SPEC: ComponentSpec = {
  name: NAME,
  implementation: { graph: { tasks: {} } },
};
const CONTENT = yaml.dump(SPEC);

function pipeline(overrides: Partial<CloudPipeline> = {}): CloudPipeline {
  return {
    id: CLOUD_ID,
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

function recovery(): RemotePipelineRecovery {
  return {
    key: "hidden-backup",
    scope: SCOPE,
    filePath: `pipeline-studio/${LOCAL_ID}.yaml`,
    displayName: NAME,
    content: CONTENT,
    dirty: false,
    modifiedAt: Date.now(),
    migrated: true,
    localFileId: LOCAL_ID,
    localStorageKey: NAME,
    pipeline: pipeline(),
    ownerId: ACCOUNT,
  };
}

function remoteService(scope = SCOPE) {
  return new PipelineStorageService({
    scope,
    connection: { backendUrl: BACKEND, authorizationToken: "token" },
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(new Map());
  await pipelineStorageDb.pipeline_registry.clear();
  await pipelineStorageDb.folders.clear();
  await remotePipelineRecoveryDb.copies.clear();
  vi.mocked(getCloudPipelineAccount).mockResolvedValue({
    id: ACCOUNT,
    permissions: ["read", "write"],
  });
  vi.mocked(listCloudPipelines).mockResolvedValue([]);
  vi.mocked(getCloudPipeline).mockResolvedValue(pipeline());
  vi.mocked(cloudPipelineToComponentSpec).mockReturnValue(SPEC);
  vi.mocked(writeCloudPipeline).mockImplementation(
    async ({ filePath, componentSpec }) =>
      pipeline({
        file_path: filePath,
        root_pipeline_task: { componentRef: { spec: componentSpec } },
      }),
  );
});

describe("hidden recovery copies", () => {
  it.each(["disabled", "other-account", "same-account"])(
    "keeps migrated local backups hidden in %s mode",
    async (mode) => {
      const service =
        mode === "disabled"
          ? new PipelineStorageService()
          : remoteService(mode === "same-account" ? SCOPE : "another-scope");
      const hidden = new PipelineFile({
        id: LOCAL_ID,
        storageKey: NAME,
        folder: service.rootFolder,
      });
      const visible = new PipelineFile({
        id: "unmigrated",
        storageKey: "Still local",
        folder: service.rootFolder,
      });
      await remotePipelineRecoveryDb.copies.put(recovery());

      await expect(
        service.filterVisibleLocalPipelines([hidden, visible]),
      ).resolves.toEqual([visible]);
    },
  );

  it.each(["disabled", "other-account"])(
    "does not reopen a hidden backup by its old ID or name in %s mode",
    async (mode) => {
      const service =
        mode === "disabled"
          ? new PipelineStorageService()
          : remoteService("another-scope");
      await pipelineStorageDb.pipeline_registry.put({
        id: LOCAL_ID,
        storageKey: NAME,
        folderId: ROOT_FOLDER_ID,
      });
      await remotePipelineRecoveryDb.copies.put(recovery());

      await expect(service.findPipelineById(LOCAL_ID)).rejects.toThrow(
        "original account and backend",
      );
      await expect(service.resolvePipelineByName(NAME)).rejects.toThrow(
        "original account and backend",
      );
    },
  );

  it("redirects the original owner's old ID and name to the remote identity", async () => {
    const service = remoteService();
    await pipelineStorageDb.pipeline_registry.put({
      id: LOCAL_ID,
      storageKey: NAME,
      folderId: ROOT_FOLDER_ID,
    });
    await remotePipelineRecoveryDb.copies.put(recovery());

    const byId = await service.findPipelineById(LOCAL_ID);
    const byName = await service.resolvePipelineByName(NAME);

    expect(byId.referenceId).toBe(remotePipelineReference(BACKEND, CLOUD_ID));
    expect(byName?.referenceId).toBe(byId.referenceId);
    expect(byId.canEdit).toBe(true);
  });
});

describe("stable pipeline identity", () => {
  it("opens a bare remote UUID on the configured backend with its scoped identity", async () => {
    const service = remoteService();

    const file = await service.resolvePipelineByName(CLOUD_ID);

    expect(file?.referenceId).toBe(remotePipelineReference(BACKEND, CLOUD_ID));
    expect(getCloudPipeline).toHaveBeenCalledWith(
      CLOUD_ID,
      expect.objectContaining({ backendUrl: BACKEND }),
    );
  });

  it("keeps old scoped remote links working and rejects a foreign backend", async () => {
    const service = remoteService();
    const reference = remotePipelineReference(BACKEND, CLOUD_ID);

    expect((await service.resolvePipelineByName(reference))?.referenceId).toBe(
      reference,
    );
    await expect(
      service.resolvePipelineByName(
        remotePipelineReference("https://another.example.com", CLOUD_ID),
      ),
    ).rejects.toThrow("different backend");
    expect(getCloudPipeline).toHaveBeenCalledTimes(1);
  });

  it("does not reinterpret local registry UUIDs as remote identities", async () => {
    const service = remoteService();
    await pipelineStorageDb.pipeline_registry.put({
      id: LOCAL_ID,
      storageKey: NAME,
      folderId: ROOT_FOLDER_ID,
    });

    const file = await service.findPipelineById(LOCAL_ID);

    expect(file.referenceId).toBe(NAME);
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("assigns one registry identity when two storage instances discover the same local file", async () => {
    const first = new PipelineStorageService();
    const second = new PipelineStorageService();

    const [firstFile, secondFile] = await Promise.all([
      first.rootFolder.assignFile(NAME),
      second.rootFolder.assignFile(NAME),
    ]);

    expect(firstFile.id).toBe(secondFile.id);
    expect(await pipelineStorageDb.pipeline_registry.count()).toBe(1);
  });

  it("routes writes from an already open local handle to the migrated server copy", async () => {
    const service = remoteService();
    const original = await service.rootFolder.assignFile(NAME);
    const openBeforeMigration = await service.findPipelineById(original.id);
    const localWrite = vi.spyOn(service.rootFolder.driver, "write");
    vi.spyOn(service.rootFolder.driver, "read").mockResolvedValue(CONTENT);

    await service.migratePipeline(original);
    await openBeforeMigration.write(
      yaml.dump({ ...SPEC, description: "Edited in the old tab" }),
    );

    expect(localWrite).not.toHaveBeenCalled();
    expect(openBeforeMigration.storageKind).toBe("remote");
    expect(vi.mocked(writeCloudPipeline).mock.calls[1][0]).toMatchObject({
      filePath: `pipeline-studio/${original.id}.yaml`,
      componentSpec: { description: "Edited in the old tab" },
      existingPipeline: { id: CLOUD_ID },
    });
  });

  it("routes a directly migrated file through its assigned redirect without a resolver callback", async () => {
    const service = remoteService();
    const original = await service.rootFolder.assignFile(NAME);
    const localWrite = vi.spyOn(service.rootFolder.driver, "write");
    vi.spyOn(service.rootFolder.driver, "read").mockResolvedValue(CONTENT);
    expect(original.resolveRedirect).toBeUndefined();

    await service.migratePipeline(original);
    await original.write(
      yaml.dump({ ...SPEC, description: "After migration" }),
    );

    expect(localWrite).not.toHaveBeenCalled();
    expect(writeCloudPipeline).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].existingPipeline?.id,
    ).toBe(CLOUD_ID);
  });
});
