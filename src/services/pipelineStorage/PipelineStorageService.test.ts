import "fake-indexeddb/auto";

import { waitFor } from "@testing-library/react";
import yaml from "js-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CloudPipeline,
  cloudPipelineToComponentSpec,
  deleteCloudPipeline,
  getCloudPipeline,
  getCloudPipelineAccount,
  getCloudPipelineSavedTaskArguments,
  listCloudPipelinePage,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { isRecord } from "@/utils/typeGuards";
import { componentSpecFromYaml } from "@/utils/yaml";

import { pipelineStorageDb } from "./db";
import { migratePipelineReferences } from "./migratePipelineReferences";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { PipelineStorageService } from "./PipelineStorageService";
import {
  recoveryKey,
  type RemotePipelineRecovery,
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "./remotePipelineRecovery";
import { ROOT_FOLDER_ID } from "./types";

vi.mock("@/services/cloudPipelineService", () => ({
  cloudPipelineToComponentSpec: vi.fn(),
  deleteCloudPipeline: vi.fn(),
  getCloudPipelineSavedTaskArguments: vi.fn(),
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
const CLOUD_ID = "20000000-0000-4000-8000-000000000001";
const OTHER_ID = "20000000-0000-4000-8000-000000000002";
const NAME = "Daily report";
const SPEC: ComponentSpec = {
  name: NAME,
  implementation: { graph: { tasks: {} } },
};
const CONTENT = yaml.dump(SPEC);
const UPDATED = yaml.dump({ ...SPEC, description: "Latest raw edit" });
const REFERENCE = remotePipelineReference(BACKEND, CLOUD_ID);

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

function recovery(
  overrides: Partial<RemotePipelineRecovery> = {},
): RemotePipelineRecovery {
  const saved = pipeline();
  return {
    key: recoveryKey(SCOPE, saved.file_path),
    scope: SCOPE,
    documentId: LOCAL_ID,
    filePath: saved.file_path,
    displayName: NAME,
    content: CONTENT,
    dirty: false,
    modifiedAt: Date.parse(saved.updated_at),
    pipeline: saved,
    ownerId: ACCOUNT,
    migrated: true,
    ...overrides,
  };
}

function service(scope = SCOPE, backendUrl = BACKEND) {
  return new PipelineStorageService({
    scope,
    connection: { backendUrl, authorizationToken: "token" },
  });
}

async function localFile(storage = service()) {
  await pipelineStorageDb.pipeline_registry.put({
    id: LOCAL_ID,
    storageKey: NAME,
    folderId: ROOT_FOLDER_ID,
  });
  vi.spyOn(storage.rootFolder.driver, "read").mockResolvedValue(CONTENT);
  vi.spyOn(storage.rootFolder.driver, "write").mockResolvedValue();
  vi.spyOn(storage.rootFolder.driver, "delete").mockResolvedValue();
  vi.spyOn(storage.rootFolder.driver, "rename").mockResolvedValue();
  return { storage, file: await storage.findPipelineById(LOCAL_ID) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  await remotePipelineRecoveryDb.copies.clear();
  await pipelineStorageDb.pipeline_registry.clear();
  await pipelineStorageDb.folders.clear();
  vi.mocked(getCloudPipelineAccount).mockResolvedValue({
    id: ACCOUNT,
    permissions: ["read", "write"],
  });
  vi.mocked(getCloudPipeline).mockResolvedValue(pipeline());
  vi.mocked(cloudPipelineToComponentSpec).mockImplementation((value) => {
    const ref = value.root_pipeline_task.componentRef;
    return isRecord(ref) ? componentSpecFromYaml(yaml.dump(ref.spec)) : SPEC;
  });
  vi.mocked(getCloudPipelineSavedTaskArguments).mockReturnValue({});
  vi.mocked(listCloudPipelinePage).mockResolvedValue({ pipelines: [] });
  vi.mocked(listCloudPipelines).mockResolvedValue([]);
  vi.mocked(writeCloudPipeline).mockImplementation(
    async ({ filePath, componentSpec }) => {
      const saved = pipeline({
        file_path: filePath,
        pipeline_name: componentSpec.name ?? null,
        root_pipeline_task: { componentRef: { spec: componentSpec } },
      });
      vi.mocked(getCloudPipeline).mockResolvedValue(saved);
      return saved;
    },
  );
  vi.mocked(deleteCloudPipeline).mockResolvedValue(undefined);
  vi.mocked(migratePipelineReferences).mockResolvedValue(undefined);
});

describe("one pipeline document across storage changes", () => {
  it("does not upload unchanged local files when opening", async () => {
    const { file } = await localFile();
    expect(await file.read()).toBe(CONTENT);
    expect(file.storageKind).toBe("local");
    expect(await remotePipelineRecoveryDb.copies.count()).toBe(0);
    expect(writeCloudPipeline).not.toHaveBeenCalled();
    expect(getCloudPipelineAccount).not.toHaveBeenCalled();
  });

  it("stages raw invalid edits durably before any parsing or upload", async () => {
    const { file } = await localFile();
    await file.persistRecovery("name: [unfinished");
    const reopened = await service().findPipelineById(LOCAL_ID);
    expect(await reopened.read()).toBe("name: [unfinished");
    expect(reopened.storageKind).toBe("local");
    expect(writeCloudPipeline).not.toHaveBeenCalled();
    expect(getCloudPipelineAccount).not.toHaveBeenCalled();
  });

  it("promotes the same object and immutable ID while changing its driver and locator", async () => {
    const { storage, file } = await localFile();
    const originalId = file.id;
    const result = await storage.migratePipeline(file);
    expect(result).toBe(file);
    expect(file.id).toBe(originalId);
    expect(file.driver.type).toBe("remote");
    expect(file.storageKind).toBe("remote");
    expect(file.referenceId).toBe(REFERENCE);
    expect(file.remoteId).toBe(CLOUD_ID);
    expect(file.remoteBackendUrl).toBe(BACKEND);
    expect(storage.rootFolder.driver.write).not.toHaveBeenCalled();
    expect(storage.rootFolder.driver.delete).not.toHaveBeenCalled();
    expect(migratePipelineReferences).toHaveBeenCalledWith(
      NAME,
      REFERENCE,
      NAME,
      LOCAL_ID,
    );
    expect(await storage.findPipelineById(LOCAL_ID)).toBe(file);
    expect((await service().findPipelineById(LOCAL_ID)).id).toBe(LOCAL_ID);
    expect(await storage.filterVisibleLocalPipelines([file])).toEqual([]);
  });

  it("automatically publishes a local edit without a second migration coordinator", async () => {
    const { file } = await localFile();
    await file.write(UPDATED);
    expect(file.storageKind).toBe("remote");
    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[0][0].componentSpec.description,
    ).toBe("Latest raw edit");
    expect(await file.read()).toBe(UPDATED);
  });

  it("keeps a failed migration local and retries its stable server path", async () => {
    const { file, storage } = await localFile();
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    await expect(file.write(UPDATED)).rejects.toThrow("Offline");
    expect(file.storageKind).toBe("local");
    expect(file.saveError).toBe("Offline");
    expect(await file.read()).toBe(UPDATED);
    expect(await storage.filterVisibleLocalPipelines([file])).toEqual([file]);
    await file.retry();
    expect(file.storageKind).toBe("remote");
    expect(
      vi
        .mocked(writeCloudPipeline)
        .mock.calls.map(([options]) => options.filePath),
    ).toEqual([
      `pipeline-studio/${LOCAL_ID}.yaml`,
      `pipeline-studio/${LOCAL_ID}.yaml`,
    ]);
  });

  it("serializes two service instances publishing the same local document", async () => {
    const first = await localFile();
    const second = await localFile();
    await Promise.all([
      first.storage.migratePipeline(first.file),
      second.storage.migratePipeline(second.file),
    ]);
    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
    expect(first.file.storageKind).toBe("remote");
    expect(second.file.storageKind).toBe("remote");
    expect(first.file.id).toBe(second.file.id);
  });

  it("finishes interrupted reference migration using the confirmed remote ID", async () => {
    const { storage, file } = await localFile();
    await remotePipelineRecoveryDb.copies.put(
      recovery({
        localFileId: LOCAL_ID,
        localStorageKey: NAME,
        migrated: false,
        dirty: true,
        content: UPDATED,
      }),
    );
    await storage.migratePipeline(file);
    expect(file.storageKind).toBe("remote");
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[0][0].existingPipeline?.id,
    ).toBe(CLOUD_ID);
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[0][0].componentSpec.description,
    ).toBe("Latest raw edit");
    expect(migratePipelineReferences).toHaveBeenCalledWith(
      NAME,
      REFERENCE,
      NAME,
      LOCAL_ID,
    );
  });

  it("does not replace a newer stage while the initial local read is slow", async () => {
    const { file } = await localFile();
    const reading = deferred<string>();
    vi.mocked(file.folder.driver.read).mockReturnValueOnce(reading.promise);
    const publishing = file.retry();
    await waitFor(() => expect(file.folder.driver.read).toHaveBeenCalled());
    await file.persistRecovery(UPDATED);
    reading.resolve(CONTENT);
    await publishing;
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[0][0].componentSpec.description,
    ).toBe("Latest raw edit");
  });

  it("retains newer revisions staged during upload and saves them on the next flush", async () => {
    const { file } = await localFile();
    const saving = deferred<CloudPipeline>();
    vi.mocked(writeCloudPipeline).mockReturnValueOnce(saving.promise);
    const first = file.write(CONTENT);
    await waitFor(() => expect(writeCloudPipeline).toHaveBeenCalledTimes(1));
    expect(file.isSaving).toBe(true);
    await file.persistRecovery(UPDATED);
    saving.resolve(pipeline());
    await first;
    expect(file.storageKind).toBe("remote");
    expect(file.saveError).toBe("Not saved to server");
    expect(await file.read()).toBe(UPDATED);
    await file.retry();
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].componentSpec.description,
    ).toBe("Latest raw edit");
    expect(file.saveError).toBeUndefined();
    expect(file.isSaving).toBe(false);
  });

  it("renames after an in-flight publication without changing its locator or identity", async () => {
    const { file } = await localFile();
    const saving = deferred<CloudPipeline>();
    vi.mocked(writeCloudPipeline).mockReturnValueOnce(saving.promise);
    const publishing = file.write(CONTENT);
    await waitFor(() => expect(writeCloudPipeline).toHaveBeenCalledTimes(1));
    const renaming = file.rename("Renamed after upload");
    saving.resolve(pipeline());
    await publishing;
    await renaming;
    expect(file.id).toBe(LOCAL_ID);
    expect(file.referenceId).toBe(REFERENCE);
    expect(file.displayName).toBe("Renamed after upload");
    expect(file.folder.driver.rename).not.toHaveBeenCalled();
    expect(vi.mocked(writeCloudPipeline).mock.calls[1][0]).toMatchObject({
      componentSpec: { name: "Renamed after upload" },
      existingPipeline: { id: CLOUD_ID },
    });
  });

  it("cannot move a pipeline into local storage after its in-flight upload confirms", async () => {
    const { file, storage } = await localFile();
    const saving = deferred<CloudPipeline>();
    vi.mocked(writeCloudPipeline).mockReturnValueOnce(saving.promise);
    const publishing = file.write(CONTENT);
    await waitFor(() => expect(writeCloudPipeline).toHaveBeenCalledTimes(1));
    const moving = file.moveTo(storage.rootFolder);
    const rejected = expect(moving).rejects.toThrow("Cannot move files out");
    saving.resolve(pipeline());
    await publishing;
    await rejected;
    expect(file.driver.type).toBe("remote");
  });

  it.each(["other-account", "other-backend"])(
    "isolates recovery from %s and hides confirmed local backups",
    async (scope) => {
      const { storage, file } = await localFile();
      await file.persistRecovery(UPDATED);
      const other = await localFile(service(scope));
      expect(await other.file.read()).toBe(CONTENT);
      await storage.migratePipeline(file);
      await expect(other.file.read()).rejects.toThrow(
        "original account and backend",
      );
      await expect(service(scope).findPipelineById(LOCAL_ID)).rejects.toThrow(
        "original account and backend",
      );
      expect(await service(scope).filterVisibleLocalPipelines([file])).toEqual(
        [],
      );
      expect(
        await new PipelineStorageService().filterVisibleLocalPipelines([file]),
      ).toEqual([]);
    },
  );

  it("returns canonical managed file handles from favorite folders", async () => {
    const storage = service();
    const folder = await storage.rootFolder.createSubfolder({
      name: "Reports",
    });
    await folder.toggleFavorite();
    const file = await folder.assignFile(NAME);
    const [favorite] = await storage.getFavoriteFolders();
    expect(await favorite.assignFile(NAME)).toBe(file);
    expect(await storage.findPipelineById(file.id)).toBe(file);
    await file.persistRecovery(UPDATED);
    expect((await remotePipelineRecoveryDb.copies.toArray())[0]).toMatchObject({
      documentId: file.id,
      content: UPDATED,
    });
  });

  it.each(["local-fs", "google-drive"])(
    "keeps %s files outside remote migration and recovery",
    async (type) => {
      const storage = service();
      const folder = new PipelineFolder({
        id: "connected",
        name: "Connected",
        parentId: null,
        driver: {
          type,
          allowsMoveIn: false,
          allowsMoveOut: false,
          list: vi.fn().mockResolvedValue([]),
          read: vi.fn().mockResolvedValue(CONTENT),
          write: vi.fn().mockResolvedValue(undefined),
          rename: vi.fn(),
          delete: vi.fn(),
          hasKey: vi.fn(),
        },
      });
      const file = new PipelineFile({ id: LOCAL_ID, folder, storageKey: NAME });
      await storage.filterVisibleLocalPipelines([file]);
      await file.persistRecovery(UPDATED);
      await file.write(UPDATED);
      expect(storage.canMigrate(file)).toBe(false);
      expect(folder.driver.write).toHaveBeenCalledWith(NAME, UPDATED);
      expect(await remotePipelineRecoveryDb.copies.count()).toBe(0);
      expect(writeCloudPipeline).not.toHaveBeenCalled();
    },
  );
});

describe("pending creation and recovery", () => {
  it("keeps the same application ID after first upload and on reload", async () => {
    const storage = service();
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    const file = await storage.createPipeline(NAME, CONTENT);
    const id = file.id;
    expect(file.storageKind).toBe("pending");
    expect(file.referenceId).toContain("pending:");
    expect(await storage.listPendingPipelines()).toEqual([file]);
    await file.retry();
    expect(file.id).toBe(id);
    expect(file.referenceId).toBe(REFERENCE);
    expect((await service().findPipelineById(id)).id).toBe(id);
    expect(await storage.listPendingPipelines()).toEqual([]);
    expect(migratePipelineReferences).toHaveBeenCalledWith(
      expect.stringMatching(/^pending:/),
      REFERENCE,
      NAME,
      id,
    );
  });

  it("fails creation when its recovery cannot be stored", async () => {
    vi.spyOn(remotePipelineRecoveryDb.copies, "put").mockRejectedValueOnce(
      new Error("Browser storage full"),
    );
    await expect(service().createPipeline(NAME, CONTENT)).rejects.toThrow(
      "Browser storage full",
    );
    expect(writeCloudPipeline).not.toHaveBeenCalled();
  });

  it("opens a failed pending creation without retrying it", async () => {
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    const created = await service().createPipeline(NAME, CONTENT);
    const reopened = await service().findPipelineById(created.referenceId);
    expect(await reopened.read()).toBe(CONTENT);
    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
    await expect(
      service("other").findPipelineById(created.referenceId),
    ).rejects.toThrow("another account or backend");
  });

  it("retains the server identity if updating local references fails", async () => {
    const { file } = await localFile();
    vi.mocked(migratePipelineReferences).mockRejectedValueOnce(
      new Error("Browser write failed"),
    );
    await expect(file.write(CONTENT)).rejects.toThrow("Browser write failed");
    expect(
      (await remotePipelineRecoveryDb.copies.toArray())[0].pipeline?.id,
    ).toBe(CLOUD_ID);
    await file.retry();
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].existingPipeline?.id,
    ).toBe(CLOUD_ID);
    expect(file.storageKind).toBe("remote");
  });

  it("reopens dirty remote recovery offline without uploading", async () => {
    await remotePipelineRecoveryDb.copies.put(
      recovery({ dirty: true, content: UPDATED }),
    );
    vi.mocked(getCloudPipeline).mockRejectedValue(new Error("Offline"));
    const file = await service().findPipelineById(REFERENCE);
    expect(await file.read()).toBe(UPDATED);
    expect(writeCloudPipeline).not.toHaveBeenCalled();
  });

  it("requires the backend for clean remote recovery and refreshes its content", async () => {
    await remotePipelineRecoveryDb.copies.put(recovery());
    vi.mocked(getCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    const unavailable = await service().findPipelineById(LOCAL_ID);
    await expect(unavailable.read()).rejects.toThrow("Offline");
    vi.mocked(getCloudPipeline).mockResolvedValueOnce(
      pipeline({
        root_pipeline_task: {
          componentRef: { spec: { ...SPEC, description: "Server edit" } },
        },
      }),
    );
    const file = await service().findPipelineById(LOCAL_ID);
    expect(await file.read()).toContain("Server edit");
    expect(writeCloudPipeline).not.toHaveBeenCalled();
  });

  it("preserves server metadata when cloning after local promotion", async () => {
    const { storage, file } = await localFile();
    await file.write(CONTENT);
    const source = file.recovery?.pipeline;
    await storage.createPipeline("Clone", CONTENT, file);
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].sourcePipeline,
    ).toEqual(source);
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].existingPipeline,
    ).toBeUndefined();
  });

  it("exposes saved task arguments from the current remote definition", async () => {
    const args = { input: "stored value" };
    vi.mocked(getCloudPipelineSavedTaskArguments).mockReturnValue(args);
    const file = await service().findPipelineById(REFERENCE);
    await file.read();
    expect(file.savedTaskArguments).toEqual(args);
    expect(getCloudPipelineSavedTaskArguments).toHaveBeenCalledWith(pipeline());
  });
});

describe("summary pages and ownership", () => {
  it("resolves an unloaded remote handle and lets the model perform exactly one definition read", async () => {
    const storage = service();
    const file = await storage.findPipelineById(REFERENCE);
    expect(file.remoteId).toBe(CLOUD_ID);
    expect(file.canEdit).toBe(false);
    expect(getCloudPipeline).not.toHaveBeenCalled();
    expect(await storage.findPipelineById(CLOUD_ID)).toBe(file);
    expect(await file.read()).toBe(CONTENT);
    expect(file.canEdit).toBe(true);
    expect(getCloudPipeline).toHaveBeenCalledTimes(1);
  });

  it("reuses a promoted file for the canonical URL without a definition request", async () => {
    const { file, storage } = await localFile();
    await file.write(CONTENT);
    expect(await storage.findPipelineById(REFERENCE)).toBe(file);
    expect(await storage.findPipelineById(CLOUD_ID)).toBe(file);
    expect(getCloudPipeline).not.toHaveBeenCalled();
    vi.mocked(getCloudPipeline).mockResolvedValue(
      pipeline({
        root_pipeline_task: {
          componentRef: { spec: { ...SPEC, description: "Another session" } },
        },
      }),
    );
    expect(await file.read()).toContain("Another session");
    expect(getCloudPipeline).toHaveBeenCalledTimes(1);
  });

  it("opens a listed summary with one definition request and rejects cached aliases from another backend", async () => {
    const storage = service();
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline()],
    });
    const [file] = (await storage.listRemotePipelinePage()).files;
    expect(await storage.findPipelineById(REFERENCE)).toBe(file);
    expect(getCloudPipeline).not.toHaveBeenCalled();
    await file.read();
    expect(getCloudPipeline).toHaveBeenCalledTimes(1);
    await expect(
      storage.findPipelineById(
        remotePipelineReference("https://other.example.com", CLOUD_ID),
      ),
    ).rejects.toThrow("different backend");
  });

  it("loads one page without definitions and preserves cursors, filters, and cancellation", async () => {
    const storage = service();
    const signal = new AbortController().signal;
    const filters = { searchQuery: "report" };
    const other = pipeline({ id: OTHER_ID, user_id: "viewer@example.com" });
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline(), other],
      nextPageToken: "next",
      totalCount: 42,
    });
    const page = await storage.listRemotePipelinePage({
      pageSize: 10,
      pageToken: "page",
      filters,
      signal,
    });
    expect(page).toMatchObject({ nextPageToken: "next", totalCount: 42 });
    expect(page.files.map((file) => file.canEdit)).toEqual([true, false]);
    expect(page.files.map((file) => file.displayName)).toEqual([NAME, NAME]);
    expect(listCloudPipelinePage).toHaveBeenCalledWith(
      expect.objectContaining({ signal }),
      { pageSize: 10, pageToken: "page", filters },
    );
    expect(getCloudPipeline).not.toHaveBeenCalled();
    expect(writeCloudPipeline).not.toHaveBeenCalled();
    expect(listCloudPipelines).not.toHaveBeenCalled();
    expect(
      (await storage.listCachedPipelines()).map((file) => file.remoteId),
    ).toEqual([CLOUD_ID]);
  });

  it("retains visited page summaries without downloading definitions", async () => {
    const storage = service();
    vi.mocked(listCloudPipelinePage)
      .mockResolvedValueOnce({ pipelines: [pipeline()], nextPageToken: "next" })
      .mockResolvedValueOnce({
        pipelines: [pipeline({ id: OTHER_ID, file_path: "another.yaml" })],
      });
    await storage.listRemotePipelinePage();
    await storage.listRemotePipelinePage({ pageToken: "next" });
    expect(
      (await storage.listCachedPipelines()).map((file) => file.remoteId).sort(),
    ).toEqual([CLOUD_ID, OTHER_ID]);
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("overlays matching dirty recovery on summaries", async () => {
    await remotePipelineRecoveryDb.copies.put(
      recovery({ dirty: true, displayName: "Unsaved title", content: UPDATED }),
    );
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline()],
    });
    const [file] = (await service().listRemotePipelinePage()).files;
    expect(file.displayName).toBe("Unsaved title");
    expect(await file.read()).toBe(UPDATED);
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it.each(["pending", "deleted", "migration", "dirty"])(
    "separates another owner's identical path from our %s draft",
    async (state) => {
      await remotePipelineRecoveryDb.copies.put(
        recovery({
          dirty: true,
          content: UPDATED,
          ...(state === "pending" ? { pipeline: undefined } : {}),
          ...(state === "deleted" ? { deleted: true } : {}),
          ...(state === "migration"
            ? { localFileId: LOCAL_ID, migrated: false }
            : {}),
        }),
      );
      const other = pipeline({ id: OTHER_ID, user_id: "someone@example.com" });
      vi.mocked(listCloudPipelinePage).mockResolvedValue({
        pipelines: [other],
      });
      vi.mocked(getCloudPipeline).mockResolvedValue(other);
      const [file] = (await service().listRemotePipelinePage()).files;
      expect(file.canEdit).toBe(false);
      expect(file.recovery?.key).not.toBe(recovery().key);
      expect(await file.read()).toBe(CONTENT);
      await expect(file.write(UPDATED)).rejects.toThrow("read-only");
      await expect(file.deleteFile()).rejects.toThrow("read-only");
      expect(writeCloudPipeline).not.toHaveBeenCalled();
      expect(deleteCloudPipeline).not.toHaveBeenCalled();
    },
  );

  it("keeps a draft staged while a summary-backed file's read is in flight", async () => {
    const storage = service();
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline()],
    });
    const [file] = (await storage.listRemotePipelinePage()).files;
    const reading = deferred<CloudPipeline>();
    vi.mocked(getCloudPipeline).mockReturnValueOnce(reading.promise);
    const content = file.read();
    await waitFor(() => expect(getCloudPipeline).toHaveBeenCalledTimes(1));
    await file.persistRecovery(UPDATED);
    reading.resolve(pipeline());
    expect(await content).toBe(UPDATED);
    expect(file.saveError).toBe("Not saved to server");
    expect((await remotePipelineRecoveryDb.copies.toArray())[0]).toMatchObject({
      dirty: true,
      content: UPDATED,
    });
  });

  it("keeps a lost-response creation pending when its server summary appears", async () => {
    await remotePipelineRecoveryDb.copies.put(
      recovery({ pipeline: undefined, migrated: false, dirty: true }),
    );
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline()],
    });
    const storage = service();
    expect((await storage.listRemotePipelinePage()).files).toEqual([]);
    expect(await storage.listPendingPipelines()).toHaveLength(1);
  });

  it("does not start an already aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service().listRemotePipelinePage({ signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(getCloudPipelineAccount).not.toHaveBeenCalled();
  });

  it("reports remote list failure while keeping cached entries available", async () => {
    const storage = service();
    await remotePipelineRecoveryDb.copies.put(recovery());
    vi.mocked(listCloudPipelinePage).mockRejectedValueOnce(
      new Error("Offline"),
    );
    await expect(storage.listRemotePipelinePage()).rejects.toThrow("Offline");
    expect(storage.remoteListError).toBe("Offline");
    expect(await storage.listCachedPipelines()).toHaveLength(1);
    expect((await storage.listRemotePipelinePage()).files).toEqual([]);
    expect(storage.remoteListError).toBeUndefined();
  });

  it("rejects writes by an owner without write permission", async () => {
    vi.mocked(getCloudPipelineAccount).mockResolvedValue({
      id: ACCOUNT,
      permissions: ["read"],
    });
    const file = await service().findPipelineById(REFERENCE);
    await file.read();
    expect(file.canEdit).toBe(false);
    await expect(file.persistRecovery(UPDATED)).rejects.toThrow("read-only");
    await expect(file.retry()).rejects.toThrow("read-only");
    expect(writeCloudPipeline).not.toHaveBeenCalled();
  });

  it("retains an owner's dirty recovery when write permission is revoked", async () => {
    await remotePipelineRecoveryDb.copies.put(
      recovery({ dirty: true, content: UPDATED }),
    );
    vi.mocked(getCloudPipelineAccount).mockResolvedValue({
      id: ACCOUNT,
      permissions: ["read"],
    });
    const file = await service().findPipelineById(REFERENCE);
    expect(file.id).toBe(LOCAL_ID);
    expect(await file.read()).toBe(UPDATED);
    expect(file.canEdit).toBe(false);
    await expect(file.write(CONTENT)).rejects.toThrow("read-only");
    expect(writeCloudPipeline).not.toHaveBeenCalled();
  });

  it("allows authorized viewers to clone a read-only pipeline", async () => {
    const other = pipeline({ user_id: "someone@example.com" });
    vi.mocked(getCloudPipeline).mockResolvedValue(other);
    const storage = service();
    const file = await storage.findPipelineById(REFERENCE);
    expect(file.canEdit).toBe(false);
    const clone = await storage.createPipeline("Clone", CONTENT, file);
    expect(clone.canEdit).toBe(true);
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[0][0].sourcePipeline,
    ).toEqual(other);
  });

  it("rejects scoped references for another backend", async () => {
    await expect(
      service().findPipelineById(
        remotePipelineReference("https://another.example.com", CLOUD_ID),
      ),
    ).rejects.toThrow("different backend");
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("keeps remote requests unavailable when disabled", async () => {
    const storage = new PipelineStorageService();
    expect(storage.backendUrl).toBe("");
    await expect(storage.listRemotePipelinePage()).rejects.toThrow(
      "not enabled",
    );
    expect(await storage.listPendingPipelines()).toEqual([]);
    expect(await storage.listCachedPipelines()).toEqual([]);
  });
});

describe("deletion and stale documents", () => {
  it.each(["pending", "local"])(
    "deletes a %s upload by stable path when its successful response was lost",
    async (kind) => {
      vi.mocked(writeCloudPipeline).mockRejectedValueOnce(
        new Error("Response lost"),
      );
      const file =
        kind === "pending"
          ? await service().createPipeline(NAME, CONTENT)
          : (await localFile()).file;
      if (kind === "local")
        await expect(file.write(CONTENT)).rejects.toThrow("Response lost");
      const path = file.recovery?.filePath;
      await file.deleteFile();
      expect(deleteCloudPipeline).toHaveBeenCalledWith(path, expect.anything());
      expect((await remotePipelineRecoveryDb.copies.toArray())[0].deleted).toBe(
        true,
      );
      await expect(file.retry()).rejects.toThrow("deleted");
      await expect(file.persistRecovery(UPDATED)).rejects.toThrow("deleted");
    },
  );

  it("keeps pending deletion retryable until the server confirms it", async () => {
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(
      new Error("Response lost"),
    );
    const file = await service().createPipeline(NAME, CONTENT);
    vi.mocked(deleteCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    await expect(file.deleteFile()).rejects.toThrow("Offline");
    expect(
      (await remotePipelineRecoveryDb.copies.toArray())[0].deleted,
    ).not.toBe(true);
    await file.deleteFile();
    expect(deleteCloudPipeline).toHaveBeenCalledTimes(2);
  });

  it("deletes a formerly pending object using its identity confirmed in another session", async () => {
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    const file = await service().createPipeline(NAME, CONTENT);
    const stale = await service().findPipelineById(file.referenceId);
    await file.retry();
    await stale.deleteFile();
    expect(deleteCloudPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: CLOUD_ID }),
      expect.anything(),
    );
  });

  it("serializes queued retry behind deletion and prevents server resurrection", async () => {
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    const file = await service().createPipeline(NAME, CONTENT);
    const deleting = deferred<void>();
    vi.mocked(deleteCloudPipeline).mockReturnValueOnce(deleting.promise);
    const deletion = file.deleteFile();
    await waitFor(() => expect(deleteCloudPipeline).toHaveBeenCalledTimes(1));
    const retry = file.retry();
    const rejected = expect(retry).rejects.toThrow("deleted");
    deleting.resolve();
    await deletion;
    await rejected;
    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
  });

  it("keeps tombstoned server summaries hidden and local backups inaccessible", async () => {
    const { file, storage } = await localFile();
    await file.write(CONTENT);
    await file.deleteFile();
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline()],
    });
    expect((await storage.listRemotePipelinePage()).files).toEqual([]);
    expect(await storage.listCachedPipelines()).toEqual([]);
    await expect(service().findPipelineById(LOCAL_ID)).rejects.toThrow(
      "deleted",
    );
    expect(
      await new PipelineStorageService().filterVisibleLocalPipelines([file]),
    ).toEqual([]);
  });
});
