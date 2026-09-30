import "fake-indexeddb/auto";

import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ComponentSpec,
  serializeComponentSpecToText,
} from "@/models/componentSpec";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  type CloudPipeline,
  getCloudPipelineAccount,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import { pipelineStorageDb } from "@/services/pipelineStorage/db";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import {
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "@/services/pipelineStorage/remotePipelineRecovery";
import { ROOT_FOLDER_ID } from "@/services/pipelineStorage/types";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
  getComponentFileFromList,
} from "@/utils/componentStore";
import { componentSpecFromYaml } from "@/utils/yaml";

import { AutoSaveStore } from "./autoSaveStore";
import { PipelineFileStore } from "./pipelineFileStore";
import { UndoStore } from "./undoStore";

vi.mock("@/services/cloudPipelineService", async (load) => ({
  ...(await load<typeof import("@/services/cloudPipelineService")>()),
  getCloudPipelineAccount: vi.fn(),
  writeCloudPipeline: vi.fn(),
}));
vi.mock("@/utils/componentStore", () => ({
  deleteComponentFileFromList: vi.fn(),
  getAllComponentFilesFromList: vi.fn(),
  getComponentFileFromList: vi.fn(),
  renameComponentFileInList: vi.fn(),
  writeComponentToFileListFromText: vi.fn(),
}));

const BACKEND = "https://backend.example.com";
const ACCOUNT = "owner@example.com";
const LOCAL_ID = "10000000-0000-4000-8000-000000000001";
const REMOTE_ID = "20000000-0000-4000-8000-000000000001";
const REFERENCE = remotePipelineReference(BACKEND, REMOTE_ID);
const NAME = "Daily report";
const RECENT_KEYS = ["Home/recently_viewed", "Home/recently_used"];
const RECENT = { type: "pipeline", id: NAME, name: NAME, timestamp: 123 };
const stores: AutoSaveStore[] = [];
let cloudPipeline: CloudPipeline | undefined;

async function openLocalPipeline() {
  const spec = new ComponentSpec({ $id: "spec", name: NAME });
  const content = serializeComponentSpecToText(spec);
  const entry: ComponentFileEntry = {
    name: NAME,
    creationTime: new Date("2026-09-17T12:00:00Z"),
    modificationTime: new Date("2026-09-17T12:00:00Z"),
    data: new TextEncoder().encode(content).buffer,
    componentRef: {
      spec: componentSpecFromYaml(content),
      digest: "local-digest",
      text: content,
    },
  };
  vi.mocked(getComponentFileFromList).mockResolvedValue(entry);
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(
    new Map([[NAME, entry]]),
  );
  await pipelineStorageDb.pipeline_registry.put({
    id: LOCAL_ID,
    storageKey: NAME,
    folderId: ROOT_FOLDER_ID,
  });
  await LibraryDB.favorites.put({ type: "pipeline", id: NAME, name: NAME });
  for (const key of RECENT_KEYS) {
    localStorage.setItem(key, JSON.stringify([RECENT]));
  }
  const storage = new PipelineStorageService({
    scope: JSON.stringify([BACKEND, ACCOUNT]),
    connection: { backendUrl: BACKEND, authorizationToken: "test-token" },
  });
  const file = await storage.findPipelineById(LOCAL_ID);
  expect(await file.read()).toBe(content);
  const files = new PipelineFileStore();
  files.init(file);
  const store = new AutoSaveStore(new UndoStore(), files, storage);
  stores.push(store);
  store.init(spec);
  return { store, storage, file, spec };
}

async function expectMigrated({
  storage,
  file,
  spec,
}: Awaited<ReturnType<typeof openLocalPipeline>>) {
  expect(file.id).toBe(LOCAL_ID);
  expect(file.storageKind).toBe("remote");
  expect(file.remoteId).toBe(REMOTE_ID);
  expect(file.referenceId).toBe(REFERENCE);
  expect(await storage.findPipelineById(LOCAL_ID)).toBe(file);
  expect(await remotePipelineRecoveryDb.copies.toArray()).toEqual([
    expect.objectContaining({
      documentId: LOCAL_ID,
      localFileId: LOCAL_ID,
      content: serializeComponentSpecToText(spec),
      dirty: false,
      migrated: true,
      pipeline: expect.objectContaining({ id: REMOTE_ID }),
    }),
  ]);
  expect(await storage.filterVisibleLocalPipelines([file])).toEqual([]);
  expect(await LibraryDB.favorites.toArray()).toEqual([
    {
      type: "pipeline",
      id: LOCAL_ID,
      name: NAME,
      pipelineReferenceId: REFERENCE,
    },
  ]);
  for (const key of RECENT_KEYS) {
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([
      { ...RECENT, id: LOCAL_ID, pipelineReferenceId: REFERENCE },
    ]);
  }
  expect(cloudPipeline?.root_pipeline_task).toMatchObject({
    componentRef: {
      spec: componentSpecFromYaml(serializeComponentSpecToText(spec)),
    },
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(new Map());
  cloudPipeline = undefined;
  localStorage.clear();
  await remotePipelineRecoveryDb.copies.clear();
  await pipelineStorageDb.pipeline_registry.clear();
  await pipelineStorageDb.folders.clear();
  await LibraryDB.favorites.clear();
  vi.mocked(getCloudPipelineAccount).mockResolvedValue({
    id: ACCOUNT,
    permissions: ["read", "write"],
  });
  vi.mocked(writeCloudPipeline).mockImplementation(
    async ({ filePath, componentSpec }) => {
      cloudPipeline = {
        id: REMOTE_ID,
        user_id: ACCOUNT,
        file_path: filePath,
        pipeline_name: componentSpec.name ?? null,
        created_at: "2026-09-17T12:00:00Z",
        updated_at: "2026-09-18T12:00:00Z",
        current_version: "version-1",
        versioning_mode: "disabled",
        version: "version-1",
        version_created_at: "2026-09-18T12:00:00Z",
        root_pipeline_task: { componentRef: { spec: componentSpec } },
        pipeline_run_annotations: {},
      };
      return cloudPipeline;
    },
  );
});

afterEach(async () => {
  for (const store of stores.splice(0)) await store.dispose();
});

describe("autosave when leaving the editor", () => {
  it("uploads the latest edit before the debounce and migrates browser references", async () => {
    const context = await openLocalPipeline();
    context.spec.setDescription("Intermediate edit");
    context.spec.setDescription("Latest edit before navigation");

    expect(writeCloudPipeline).not.toHaveBeenCalled();
    expect(await context.store.dispose()).toBe(true);

    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
    await expectMigrated(context);
  });

  it("retries a failed autosave on navigation without requiring another edit", async () => {
    const context = await openLocalPipeline();
    vi.mocked(writeCloudPipeline).mockRejectedValueOnce(new Error("Offline"));
    context.spec.setDescription("Recoverable edit");

    await waitFor(
      () => {
        expect(context.store.error).toBe("Offline");
        expect(context.store.isSaving).toBe(false);
      },
      { timeout: 3000 },
    );
    expect(writeCloudPipeline).toHaveBeenCalledTimes(1);
    expect(context.file.storageKind).toBe("local");
    expect(await remotePipelineRecoveryDb.copies.toArray()).toEqual([
      expect.objectContaining({
        content: serializeComponentSpecToText(context.spec),
        dirty: true,
        error: "Offline",
      }),
    ]);

    expect(await context.store.dispose()).toBe(true);

    expect(writeCloudPipeline).toHaveBeenCalledTimes(2);
    await expectMigrated(context);
  });

  it("leaves an unchanged local pipeline unpublished when the editor closes", async () => {
    const { store, storage, file } = await openLocalPipeline();

    expect(await store.dispose()).toBe(true);

    expect(writeCloudPipeline).not.toHaveBeenCalled();
    expect(file.storageKind).toBe("local");
    expect(await remotePipelineRecoveryDb.copies.count()).toBe(0);
    expect(await storage.filterVisibleLocalPipelines([file])).toEqual([file]);
    expect(await LibraryDB.favorites.toArray()).toEqual([
      { type: "pipeline", id: NAME, name: NAME },
    ]);
    for (const key of RECENT_KEYS) {
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual([RECENT]);
    }
  });
});
