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
  listCloudPipelinePage,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import { migratePipelineReferences } from "@/services/pipelineStorage/migratePipelineReferences";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import { RemotePipelineFile } from "@/services/pipelineStorage/RemotePipelineFile";
import {
  type RemotePipelineRecovery,
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "@/services/pipelineStorage/remotePipelineRecovery";
import { RemotePipelineStore } from "@/services/pipelineStorage/RemotePipelineStore";
import type { PipelineStorageDriver } from "@/services/pipelineStorage/types";
import type { ComponentSpec } from "@/utils/componentSpec";

vi.mock("@/services/cloudPipelineService", () => ({
  cloudPipelineToComponentSpec: vi.fn(),
  deleteCloudPipeline: vi.fn(),
  getCloudPipeline: vi.fn(),
  getCloudPipelineAccount: vi.fn(),
  listCloudPipelinePage: vi.fn(),
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
const CLOUD_ID = "20000000-0000-4000-8000-000000000001";
const LOCAL_ID = "10000000-0000-4000-8000-000000000001";
const BACKEND = "https://backend.example.com";
const SCOPE = JSON.stringify([BACKEND, ACCOUNT]);
const NAME = "Daily report";
const SPEC: ComponentSpec = {
  name: NAME,
  implementation: { graph: { tasks: {} } },
};
const CONTENT = yaml.dump(SPEC);
const UPDATED_CONTENT = yaml.dump({ ...SPEC, description: "Unsaved work" });

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
    key: `pending:${encodeURIComponent(SCOPE)}:${encodeURIComponent(saved.file_path)}`,
    scope: SCOPE,
    filePath: saved.file_path,
    displayName: NAME,
    content: CONTENT,
    dirty: false,
    modifiedAt: Date.parse(saved.updated_at),
    pipeline: saved,
    ...overrides,
  };
}

function setup(scope = SCOPE) {
  const driver: PipelineStorageDriver = {
    type: "root-indexdb",
    allowsMoveIn: true,
    allowsMoveOut: true,
    list: vi.fn().mockResolvedValue([]),
    read: vi.fn().mockResolvedValue(CONTENT),
    write: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    hasKey: vi.fn().mockResolvedValue(true),
  };
  const folder = new PipelineFolder({
    id: "root",
    name: "Root",
    parentId: null,
    driver,
  });
  const store = new RemotePipelineStore(
    {
      scope,
      connection: { backendUrl: BACKEND, authorizationToken: "token" },
    },
    folder,
  );
  const local = new PipelineFile({ id: LOCAL_ID, storageKey: NAME, folder });
  return { store, folder, driver, local };
}

beforeEach(async () => {
  vi.resetAllMocks();
  await remotePipelineRecoveryDb.copies.clear();
  vi.mocked(getCloudPipelineAccount).mockResolvedValue({
    id: ACCOUNT,
    permissions: ["read", "write"],
  });
  vi.mocked(listCloudPipelines).mockResolvedValue([]);
  vi.mocked(listCloudPipelinePage).mockResolvedValue({ pipelines: [] });
  vi.mocked(getCloudPipeline).mockResolvedValue(pipeline());
  vi.mocked(cloudPipelineToComponentSpec).mockReturnValue(SPEC);
  vi.mocked(migratePipelineReferences).mockResolvedValue(undefined);
  vi.mocked(writeCloudPipeline).mockImplementation(
    async ({ filePath, componentSpec }) =>
      pipeline({
        file_path: filePath,
        pipeline_name: componentSpec.name ?? null,
        root_pipeline_task: { componentRef: { spec: componentSpec } },
      }),
  );
  vi.mocked(deleteCloudPipeline).mockResolvedValue(undefined);
});

describe("remote pipeline listing", () => {
  it("loads one summary page with matching dirty recovery and no detail requests", async () => {
    const { store } = setup();
    const signal = new AbortController().signal;
    const draft = recovery({
      dirty: true,
      displayName: "Unsaved rename",
      content: UPDATED_CONTENT,
      modifiedAt: Date.parse("2026-09-20T12:00:00Z"),
    });
    await remotePipelineRecoveryDb.copies.put(draft);
    vi.mocked(listCloudPipelinePage).mockResolvedValue({
      pipelines: [pipeline(), pipeline({ user_id: "other@example.com" })],
      nextPageToken: "next-page",
      totalCount: 42,
    });

    const page = await store.listPage({
      pageSize: 10,
      pageToken: "current-page",
      signal,
    });

    expect(page).toMatchObject({
      files: [{ displayName: "Unsaved rename", recovery: draft }],
      nextPageToken: "next-page",
      totalCount: 42,
    });
    expect(page.files).toHaveLength(1);
    expect(listCloudPipelinePage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        backendUrl: BACKEND,
        authorizationToken: "token",
        account: { id: ACCOUNT, permissions: ["read", "write"] },
        signal,
      }),
      { pageSize: 10, pageToken: "current-page" },
    );
    expect(listCloudPipelines).not.toHaveBeenCalled();
    expect(getCloudPipeline).not.toHaveBeenCalled();
    expect(writeCloudPipeline).not.toHaveBeenCalled();
  });

  it("does not remove earlier recovery copies when loading another page", async () => {
    const { store } = setup();
    const first = recovery();
    const second = pipeline({
      id: "20000000-0000-4000-8000-000000000002",
      file_path: "pipeline-studio/second.yaml",
    });
    await remotePipelineRecoveryDb.copies.put(first);
    vi.mocked(listCloudPipelinePage)
      .mockResolvedValueOnce({
        pipelines: [pipeline()],
        nextPageToken: "second-page",
      })
      .mockResolvedValueOnce({ pipelines: [second] });

    await store.listPage();
    const page = await store.listPage({ pageToken: "second-page" });

    expect(page.files.map((file) => file.referenceId)).toEqual([
      remotePipelineReference(BACKEND, second.id),
    ]);
    expect(await store.records()).toEqual([first]);
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it.each(["scope", "identity"])(
    "does not attach a draft with a different %s to a matching file path",
    async (mismatch) => {
      const { store } = setup();
      await remotePipelineRecoveryDb.copies.put(
        recovery({
          dirty: true,
          displayName: "Unrelated draft",
          ...(mismatch === "scope"
            ? { scope: "another-account" }
            : {
                pipeline: pipeline({
                  id: "20000000-0000-4000-8000-000000000002",
                }),
              }),
        }),
      );
      vi.mocked(listCloudPipelinePage).mockResolvedValue({
        pipelines: [pipeline()],
      });

      const { files } = await store.listPage();

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        displayName: NAME,
        recovery: { dirty: false, content: "" },
      });
    },
  );

  it("groups only unsaved creations for this account into the pending list", async () => {
    const { store } = setup();
    const pending = recovery({
      key: "new-pipeline",
      filePath: "pipeline-studio/new.yaml",
      pipeline: undefined,
      dirty: true,
    });
    await remotePipelineRecoveryDb.copies.bulkPut([
      pending,
      recovery(),
      recovery({ key: "local", pipeline: undefined, localFileId: LOCAL_ID }),
      recovery({ key: "deleted", pipeline: undefined, deleted: true }),
      recovery({ key: "other", pipeline: undefined, scope: "other-account" }),
    ]);

    const files = await store.listPending();

    expect(files).toHaveLength(1);
    expect(files[0].recovery).toEqual(pending);
    expect(files[0].storageKind).toBe("pending");
    expect(getCloudPipelineAccount).not.toHaveBeenCalled();
    expect(listCloudPipelinePage).not.toHaveBeenCalled();
    expect(listCloudPipelines).not.toHaveBeenCalled();
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it.each(["page", "summaries"])(
    "keeps a creation with a lost response only in the pending tab during %s listing",
    async (listing) => {
      const { store } = setup();
      const pending = recovery({
        pipeline: undefined,
        dirty: true,
        content: UPDATED_CONTENT,
      });
      await remotePipelineRecoveryDb.copies.put(pending);
      vi.mocked(listCloudPipelinePage).mockResolvedValue({
        pipelines: [pipeline()],
      });
      vi.mocked(listCloudPipelines).mockResolvedValue([pipeline()]);

      const remoteFiles =
        listing === "page"
          ? (await store.listPage()).files
          : await store.listSummaries();
      const pendingFiles = await store.listPending();

      expect(remoteFiles).toEqual([]);
      expect(pendingFiles).toHaveLength(1);
      expect(pendingFiles[0].recovery).toEqual(pending);
      expect(getCloudPipeline).not.toHaveBeenCalled();
      expect(writeCloudPipeline).not.toHaveBeenCalled();
    },
  );

  it("lists the complete summary catalog without pending or unfinished local migrations", async () => {
    const { store } = setup();
    const draft = recovery({ dirty: true, displayName: "Unsaved rename" });
    const migration = pipeline({
      id: "20000000-0000-4000-8000-000000000002",
      file_path: "pipeline-studio/local.yaml",
    });
    const deleted = pipeline({
      id: "20000000-0000-4000-8000-000000000003",
      file_path: "pipeline-studio/deleted.yaml",
    });
    await remotePipelineRecoveryDb.copies.bulkPut([
      draft,
      recovery({
        key: "local",
        filePath: migration.file_path,
        pipeline: migration,
        localFileId: LOCAL_ID,
      }),
      recovery({
        key: "deleted",
        filePath: deleted.file_path,
        pipeline: deleted,
        deleted: true,
      }),
      recovery({
        key: "pending",
        filePath: "pipeline-studio/pending.yaml",
        pipeline: undefined,
        dirty: true,
      }),
    ]);
    vi.mocked(listCloudPipelines).mockResolvedValue([
      pipeline(),
      migration,
      deleted,
      pipeline({ user_id: "other@example.com" }),
    ]);

    const files = await store.listSummaries();

    expect(files).toHaveLength(1);
    expect(files[0].recovery).toEqual(draft);
    expect(listCloudPipelines).toHaveBeenCalledTimes(1);
    expect(listCloudPipelinePage).not.toHaveBeenCalled();
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("lists cached remote copies for this scope while retaining dirty recovery", async () => {
    const { store } = setup();
    const draft = recovery({
      dirty: true,
      displayName: "Unsaved rename",
      content: UPDATED_CONTENT,
    });
    const migrated = recovery({
      key: "migrated",
      localFileId: LOCAL_ID,
      migrated: true,
    });
    await remotePipelineRecoveryDb.copies.bulkPut([
      draft,
      migrated,
      recovery({ key: "unfinished", localFileId: LOCAL_ID }),
      recovery({ key: "pending", pipeline: undefined }),
      recovery({ key: "deleted", deleted: true }),
      recovery({ key: "other", scope: "another-account" }),
    ]);

    const files = await store.listCached();

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.recovery)).toEqual(
      expect.arrayContaining([migrated, draft]),
    );
    expect(files.every((file) => file.storageKind === "remote")).toBe(true);
    expect(files[1].createdAt).toEqual(new Date(pipeline().created_at));
    expect(getCloudPipelineAccount).not.toHaveBeenCalled();
    expect(listCloudPipelinePage).not.toHaveBeenCalled();
    expect(listCloudPipelines).not.toHaveBeenCalled();
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("propagates list failures for query error handling", async () => {
    const { store } = setup();
    vi.mocked(listCloudPipelinePage).mockRejectedValue(new Error("Offline"));
    vi.mocked(listCloudPipelines).mockRejectedValue(new Error("Offline"));

    await expect(store.listPage()).rejects.toThrow("Offline");
    await expect(store.listSummaries()).rejects.toThrow("Offline");
  });
});

describe("local pipeline migration", () => {
  it("moves references only after the server confirms and retains the original local file", async () => {
    const { store, local, driver } = setup();
    let finishSave!: (pipeline: CloudPipeline) => void;
    vi.mocked(writeCloudPipeline).mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );

    const migration = store.migrate(local);
    await waitFor(() => expect(writeCloudPipeline).toHaveBeenCalledTimes(1));
    expect(migratePipelineReferences).not.toHaveBeenCalled();
    expect(local.storageKind).toBe("local");
    expect((await store.records())[0]).toMatchObject({
      localFileId: LOCAL_ID,
      dirty: true,
    });

    finishSave(pipeline());
    const remote = await migration;

    expect(remote.referenceId).toBe(remotePipelineReference(BACKEND, CLOUD_ID));
    expect(local.redirectedFile).toBe(remote);
    expect(migratePipelineReferences).toHaveBeenCalledWith(
      NAME,
      remote.referenceId,
      NAME,
    );
    expect((await store.records())[0]).toMatchObject({
      migrated: true,
      dirty: false,
      content: CONTENT,
    });
    expect(driver.write).not.toHaveBeenCalled();
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("retains a failed migration locally and retries the same remote path", async () => {
    const { store, local, driver } = setup();
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(
      new Error("Server unavailable"),
    );

    await expect(store.migrate(local)).rejects.toThrow("Server unavailable");
    expect(local.redirectedFile).toBeUndefined();
    expect(migratePipelineReferences).not.toHaveBeenCalled();
    const [failed] = await store.records();
    expect(failed).toMatchObject({
      dirty: true,
      error: "Server unavailable",
      localFileId: LOCAL_ID,
    });
    expect(failed.migrated).not.toBe(true);

    await store.migrate(local);

    expect(
      vi
        .mocked(writeCloudPipeline)
        .mock.calls.map(([options]) => options.filePath),
    ).toEqual([
      `pipeline-studio/${LOCAL_ID}.yaml`,
      `pipeline-studio/${LOCAL_ID}.yaml`,
    ]);
    expect(driver.write).not.toHaveBeenCalled();
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("serializes two first uploads of the same local file", async () => {
    const { store, local } = setup();

    const [first, second] = await Promise.all([
      store.migrate(local),
      store.migrate(local),
    ]);

    expect(first.referenceId).toBe(second.referenceId);
    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
    expect(await store.records()).toHaveLength(1);
  });

  it("finishes an interrupted migration using its confirmed server identity and latest recovery", async () => {
    const { store, local, driver } = setup();
    await store.stageLocal(local, UPDATED_CONTENT);
    const [recovery] = await store.records();
    const published = pipeline({
      root_pipeline_task: {
        componentRef: { spec: { ...SPEC, description: "Unsaved work" } },
      },
    });
    await remotePipelineRecoveryDb.copies.put({
      ...recovery,
      pipeline: published,
      ownerId: ACCOUNT,
      dirty: false,
    });

    const remote = await store.migrate(local);

    expect(driver.read).toHaveBeenCalledExactlyOnceWith(NAME);
    expect(writeCloudPipeline).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        filePath: published.file_path,
        componentSpec: { ...SPEC, description: "Unsaved work" },
        existingPipeline: published,
      }),
      expect.anything(),
    );
    expect(migratePipelineReferences).toHaveBeenCalledExactlyOnceWith(
      NAME,
      remotePipelineReference(BACKEND, CLOUD_ID),
      NAME,
    );
    expect(local.redirectedFile).toBe(remote);
    expect(await store.records()).toEqual([
      expect.objectContaining({
        content: UPDATED_CONTENT,
        revision: recovery.revision,
        pipeline: expect.objectContaining({ id: CLOUD_ID }),
        migrated: true,
        dirty: false,
      }),
    ]);
    expect(driver.write).not.toHaveBeenCalled();
  });

  it("migrates the latest staged draft instead of an older local read", async () => {
    const { store, local, driver } = setup();
    let finishRead!: (content: string) => void;
    vi.mocked(driver.read).mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = resolve;
      }),
    );

    const migration = store.migrate(local);
    await waitFor(() => expect(driver.read).toHaveBeenCalledTimes(1));
    await store.stageLocal(local, UPDATED_CONTENT);
    finishRead(CONTENT);
    await migration;

    expect(vi.mocked(writeCloudPipeline).mock.calls[0][0]).toMatchObject({
      componentSpec: { description: "Unsaved work" },
    });
    expect((await store.records())[0]).toMatchObject({
      content: UPDATED_CONTENT,
      migrated: true,
      dirty: false,
    });
    expect(driver.write).not.toHaveBeenCalled();
  });

  it("preserves remote settings when cloning immediately after publication", async () => {
    const { store, local } = setup();
    const published = pipeline({
      pipeline_run_annotations: { environment: "production" },
    });
    vi.mocked(writeCloudPipeline).mockResolvedValueOnce(published);
    await store.migrate(local);

    await store.create("My copy", CONTENT, local);

    expect(writeCloudPipeline).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourcePipeline: published,
        existingPipeline: undefined,
      }),
      expect.anything(),
    );
  });
});

describe("pending pipelines and recovery", () => {
  it("migrates local references once rather than on every remote autosave", async () => {
    const { store } = setup();
    const file = await store.create(NAME, CONTENT);

    await file.write(UPDATED_CONTENT);

    expect(writeCloudPipeline).toHaveBeenCalledTimes(2);
    expect(migratePipelineReferences).toHaveBeenCalledExactlyOnceWith(
      file.recovery.key,
      file.referenceId,
      NAME,
    );
  });

  it("does not report a recoverable creation when browser storage fails", async () => {
    const { store } = setup();
    const put = vi
      .spyOn(remotePipelineRecoveryDb.copies, "put")
      .mockRejectedValueOnce(new Error("Storage full"));
    try {
      await expect(store.create(NAME, CONTENT)).rejects.toThrow("Storage full");
      expect(writeCloudPipeline).not.toHaveBeenCalled();
    } finally {
      put.mockRestore();
    }
  });

  it("shows a failed new pipeline as pending and redirects its references on retry", async () => {
    const { store } = setup();
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));

    const file = await store.create(NAME, CONTENT);
    const pendingReference = file.referenceId;
    expect(file.storageKind).toBe("pending");
    expect(file.saveError).toBe("Offline");
    expect((await store.list()).map((item) => item.referenceId)).toContain(
      pendingReference,
    );

    await file.retry();

    expect(file.storageKind).toBe("remote");
    expect(file.saveError).toBeUndefined();
    expect(migratePipelineReferences).toHaveBeenCalledWith(
      pendingReference,
      file.referenceId,
      NAME,
    );
    const calls = vi.mocked(writeCloudPipeline).mock.calls;
    expect(calls[0][0].filePath).toBe(calls[1][0].filePath);
  });

  it("keeps recovery copies isolated by account/backend scope", async () => {
    const first = setup();
    const other = setup(
      JSON.stringify(["https://another.example.com", "other@example.com"]),
    );
    vi.mocked(writeCloudPipeline).mockRejectedValue(new Error("Offline"));
    const file = await first.store.create(NAME, CONTENT);

    expect(await other.store.list()).toEqual([]);
    await expect(other.store.resolve(file.referenceId)).rejects.toThrow(
      "another account or backend",
    );
    await expect(
      first.store.resolve(
        remotePipelineReference("https://another.example.com", CLOUD_ID),
      ),
    ).rejects.toThrow("different backend");
  });

  it("does not overwrite a newer dirty recovery when another file instance reads", async () => {
    const { store, folder } = setup();
    const file = await store.create(NAME, CONTENT);
    const stale = new RemotePipelineFile(
      store,
      folder,
      structuredClone(file.recovery),
    );
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    await expect(file.write(UPDATED_CONTENT)).rejects.toThrow("Offline");

    await expect(stale.read()).resolves.toBe(UPDATED_CONTENT);

    expect((await store.records())[0]).toMatchObject({
      content: UPDATED_CONTENT,
      dirty: true,
    });
    expect(getCloudPipeline).not.toHaveBeenCalled();
  });

  it("reopens a saved pipeline's pending changes while the backend is unavailable", async () => {
    const { store } = setup();
    const file = await store.create(NAME, CONTENT);
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    await expect(file.write(UPDATED_CONTENT)).rejects.toThrow("Offline");
    vi.mocked(getCloudPipeline).mockRejectedValue(new Error("Offline"));

    const reopened = await store.resolve(file.referenceId);

    await expect(reopened?.read()).resolves.toBe(UPDATED_CONTENT);
    expect(reopened?.saveError).toBe("Offline");
  });

  it("keeps the server identity after local reference migration fails", async () => {
    const { store, local } = setup();
    vi.mocked(migratePipelineReferences).mockRejectedValueOnce(
      new Error("Browser storage is full"),
    );

    await expect(store.migrate(local)).rejects.toThrow(
      "Browser storage is full",
    );
    expect((await store.records())[0].pipeline?.id).toBe(CLOUD_ID);
    await store.migrate(local);

    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].existingPipeline?.id,
    ).toBe(CLOUD_ID);
    expect((await store.records())[0].migrated).toBe(true);
  });

  it("retries pending references after the server save succeeds but local reference migration fails", async () => {
    const { store } = setup();
    vi.mocked(migratePipelineReferences).mockRejectedValueOnce(
      new Error("Browser storage is full"),
    );

    const file = await store.create(NAME, CONTENT);
    const originalPendingReference = file.recovery.key;
    const remoteReference = remotePipelineReference(BACKEND, CLOUD_ID);
    expect(file.referenceId).toBe(remoteReference);
    expect(file.saveError).toBe("Browser storage is full");
    expect(migratePipelineReferences).toHaveBeenNthCalledWith(
      1,
      originalPendingReference,
      remoteReference,
      NAME,
    );

    await file.retry();

    expect(migratePipelineReferences).toHaveBeenNthCalledWith(
      2,
      originalPendingReference,
      remoteReference,
      NAME,
    );
    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].existingPipeline?.id,
    ).toBe(CLOUD_ID);
    expect(file.saveError).toBeUndefined();
    expect(await store.records()).toHaveLength(1);
  });

  it("preserves newer staged content while a save is in flight and retries the latest draft", async () => {
    const { store } = setup();
    const file = await store.create(NAME, CONTENT);
    let finishSave!: (pipeline: CloudPipeline) => void;
    vi.mocked(writeCloudPipeline).mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    const writing = file.write(CONTENT);
    await waitFor(() => expect(writeCloudPipeline).toHaveBeenCalledTimes(2));

    await store.stage(file, UPDATED_CONTENT);
    finishSave(pipeline({ file_path: file.recovery.filePath }));
    await writing;

    expect((await store.records())[0]).toMatchObject({
      content: UPDATED_CONTENT,
      dirty: true,
    });
    expect(file.recovery.content).toBe(UPDATED_CONTENT);

    await file.retry();

    expect(
      vi.mocked(writeCloudPipeline).mock.calls[2][0].componentSpec.description,
    ).toBe("Unsaved work");
    expect((await store.records())[0]).toMatchObject({
      content: UPDATED_CONTENT,
      dirty: false,
    });
  });

  it("preserves a draft staged while an older server read is in flight", async () => {
    const { store } = setup();
    const file = await store.create(NAME, CONTENT);
    let finishRead!: (pipeline: CloudPipeline) => void;
    vi.mocked(getCloudPipeline).mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = resolve;
      }),
    );
    const reading = file.read();
    await waitFor(() => expect(getCloudPipeline).toHaveBeenCalledTimes(1));

    await store.stage(file, UPDATED_CONTENT);
    finishRead(pipeline({ file_path: file.recovery.filePath }));

    await expect(reading).resolves.toBe(UPDATED_CONTENT);
    expect((await store.records())[0]).toMatchObject({
      content: UPDATED_CONTENT,
      dirty: true,
    });
  });

  it("retries the newest persisted draft from an older list-row instance", async () => {
    const { store, folder } = setup();
    const file = await store.create(NAME, CONTENT);
    const stale = new RemotePipelineFile(
      store,
      folder,
      structuredClone(file.recovery),
    );
    await store.stage(file, UPDATED_CONTENT);

    await stale.retry();

    expect(
      vi.mocked(writeCloudPipeline).mock.calls[1][0].componentSpec.description,
    ).toBe("Unsaved work");
    expect((await store.records())[0]).toMatchObject({
      content: UPDATED_CONTENT,
      dirty: false,
    });
  });
});

describe("remote ownership and deletion", () => {
  it("still rejects remote recovery and uploads for an owner without write permission", async () => {
    const { store } = setup();
    vi.mocked(getCloudPipelineAccount).mockResolvedValue({
      id: ACCOUNT,
      permissions: ["read"],
    });
    const file = await store.resolve(
      remotePipelineReference(BACKEND, CLOUD_ID),
    );
    if (!file) throw new Error("Missing remote file");

    expect(file.canEdit).toBe(false);
    await expect(file.persistRecovery(UPDATED_CONTENT)).rejects.toThrow(
      "Only the owner",
    );
    await expect(file.retry()).rejects.toThrow("Only the owner");
    expect(writeCloudPipeline).not.toHaveBeenCalled();
    expect(await store.records()).toEqual([]);
  });

  it("allows another owner's pipeline to be read and cloned, but prevents edits and deletion", async () => {
    const { store } = setup();
    const source = pipeline({ user_id: "other@example.com" });
    vi.mocked(getCloudPipeline).mockResolvedValue(source);
    const file = await store.resolve(
      remotePipelineReference(BACKEND, CLOUD_ID),
    );
    if (!file) throw new Error("Missing remote file");
    expect(file.canEdit).toBe(false);

    await expect(file.read()).resolves.toBe(CONTENT);
    await expect(file.write(UPDATED_CONTENT)).rejects.toThrow("Only the owner");
    await expect(file.deleteFile()).rejects.toThrow("Only the owner");
    expect(deleteCloudPipeline).not.toHaveBeenCalled();

    const clone = await store.create("My copy", CONTENT, file);

    expect(clone.canEdit).toBe(true);
    expect(writeCloudPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePipeline: source,
        existingPipeline: undefined,
      }),
      expect.anything(),
    );
  });

  it("deletes the server copy when a formerly pending object has become remote elsewhere", async () => {
    const { store, folder } = setup();
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    const file = await store.create(NAME, CONTENT);
    const stale = new RemotePipelineFile(
      store,
      folder,
      structuredClone(file.recovery),
    );
    await file.retry();

    await stale.deleteFile();

    expect(deleteCloudPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: CLOUD_ID }),
      expect.anything(),
    );
    expect((await store.records())[0]).toMatchObject({
      deleted: true,
      dirty: false,
      pipeline: { id: CLOUD_ID },
    });
  });

  it.each(["remote", "pending"])(
    "rejects stale edits and retries after deleting a native %s pipeline",
    async (kind) => {
      const { store, folder } = setup();
      if (kind === "pending")
        vi.mocked(writeCloudPipeline).mockRejectedValueOnce(
          new Error("Offline"),
        );
      const file = await store.create(NAME, CONTENT);
      const stale = new RemotePipelineFile(
        store,
        folder,
        structuredClone(file.recovery),
      );

      await file.deleteFile();

      await expect(stale.write(UPDATED_CONTENT)).rejects.toThrow("deleted");
      await expect(stale.retry()).rejects.toThrow("deleted");
      await expect(stale.read()).rejects.toThrow("deleted");
      await expect(store.resolve(file.recovery.key)).rejects.toThrow("deleted");
      expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
      expect(deleteCloudPipeline).toHaveBeenCalledTimes(
        kind === "remote" ? 1 : 0,
      );
      expect(await store.list()).toEqual([]);
    },
  );

  it("rejects a pending retry queued behind deletion before making a server request", async () => {
    const { store, folder } = setup();
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    const file = await store.create(NAME, CONTENT);
    const stale = new RemotePipelineFile(
      store,
      folder,
      structuredClone(file.recovery),
    );

    const deleting = file.deleteFile();
    const retry = expect(stale.retry()).rejects.toThrow("deleted");
    await deleting;
    await retry;

    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
    expect(deleteCloudPipeline).not.toHaveBeenCalled();
    expect((await store.records())[0]).toMatchObject({
      deleted: true,
      dirty: false,
    });
  });

  it("keeps a deleted pipeline hidden if the server list still includes it", async () => {
    const { store } = setup();
    const file = await store.create(NAME, CONTENT);
    vi.mocked(listCloudPipelines).mockResolvedValue([
      pipeline({ file_path: file.recovery.filePath }),
    ]);

    await file.deleteFile();

    expect(await store.list()).toEqual([]);
  });

  it("retains the hidden local backup after deletion and rejects its old pending reference", async () => {
    const { store, local, driver } = setup();
    const file = await store.migrate(local);
    const recoveryReference = file.recovery.key;

    await file.deleteFile();

    expect((await store.records())[0]).toMatchObject({
      deleted: true,
      migrated: true,
      localFileId: LOCAL_ID,
    });
    expect(driver.delete).not.toHaveBeenCalled();
    await expect(store.resolveLocal(LOCAL_ID)).rejects.toThrow("deleted");
    await expect(store.resolve(recoveryReference)).rejects.toThrow("deleted");
  });
});
