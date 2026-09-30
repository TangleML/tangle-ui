import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadDataWithCache } from "@/utils/cache";
import {
  type ComponentFileEntry,
  fullyLoadComponentRefFromUrl,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";

import { loadPipelineByName } from "./pipelineService";
import { pipelineStorageDb } from "./pipelineStorage/db";
import { remotePipelineRecoveryDb } from "./pipelineStorage/remotePipelineRecovery";
import { ROOT_FOLDER_ID } from "./pipelineStorage/types";

vi.mock("@/appSettings", () => ({
  getAppSettings: () => ({ pipelineLibraryUrl: "https://example.com/library" }),
}));
vi.mock("@/utils/cache", () => ({
  downloadDataWithCache: vi.fn(),
  loadObjectFromYamlData: vi.fn(),
}));
vi.mock("@/utils/componentStore", () => ({
  deleteComponentFileFromList: vi.fn(),
  fullyLoadComponentRefFromUrl: vi.fn(),
  getAllComponentFilesFromList: vi.fn(),
  getComponentFileFromList: vi.fn(),
  writeComponentToFileListFromText: vi.fn(),
}));

const NAME = "Daily report";
const LOCAL_ID = "local-pipeline-id";
const ENTRY: ComponentFileEntry = {
  name: NAME,
  creationTime: new Date("2026-09-18T12:00:00Z"),
  modificationTime: new Date("2026-09-18T12:00:00Z"),
  data: new ArrayBuffer(0),
  componentRef: {
    spec: { name: NAME, implementation: { graph: { tasks: {} } } },
    text: "",
    digest: "test-digest",
  },
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(new Map());
  await pipelineStorageDb.pipeline_registry.clear();
  await remotePipelineRecoveryDb.copies.clear();
  await pipelineStorageDb.pipeline_registry.put({
    id: LOCAL_ID,
    storageKey: NAME,
    folderId: ROOT_FOLDER_ID,
  });
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(
    new Map([[NAME, ENTRY]]),
  );
});

afterEach(() => vi.restoreAllMocks());

describe("legacy pipeline loading with remote mode disabled", () => {
  it.each([false, true])(
    "blocks a migrated backup, including deleted remote entries (%s)",
    async (deleted) => {
      await remotePipelineRecoveryDb.copies.put({
        key: "migration",
        scope: "original-account-and-backend",
        filePath: "pipeline-studio/original.yaml",
        displayName: NAME,
        content: "retained backup",
        dirty: false,
        modifiedAt: Date.now(),
        localFileId: LOCAL_ID,
        localStorageKey: NAME,
        migrated: true,
        deleted,
      });

      expect(await loadPipelineByName(encodeURIComponent(NAME))).toEqual({
        experiment: null,
        isLoading: false,
        error:
          "This pipeline was moved to remote storage. Open it using the original account and backend.",
      });
      expect(downloadDataWithCache).not.toHaveBeenCalled();
      expect(await remotePipelineRecoveryDb.copies.count()).toBe(1);
    },
  );

  it("keeps a failed, unconfirmed migration accessible locally", async () => {
    await remotePipelineRecoveryDb.copies.put({
      key: "failed-migration",
      scope: "original-account-and-backend",
      filePath: "pipeline-studio/original.yaml",
      displayName: NAME,
      content: "retained backup",
      dirty: true,
      modifiedAt: Date.now(),
      localFileId: LOCAL_ID,
      localStorageKey: NAME,
      migrated: false,
    });

    expect(await loadPipelineByName(NAME)).toEqual({
      experiment: ENTRY,
      isLoading: false,
      error: null,
    });
  });

  it.each([false, true])(
    "keeps ordinary local loading unchanged (registered: %s)",
    async (registered) => {
      if (!registered) await pipelineStorageDb.pipeline_registry.clear();

      expect(await loadPipelineByName(NAME)).toEqual({
        experiment: ENTRY,
        isLoading: false,
        error: null,
      });
    },
  );

  it("preserves library fallback when no local pipeline exists", async () => {
    vi.mocked(getAllComponentFilesFromList).mockResolvedValue(new Map());
    vi.mocked(downloadDataWithCache).mockResolvedValue({
      components: [{ name: NAME, url: "https://example.com/pipeline.yaml" }],
    });
    vi.mocked(fullyLoadComponentRefFromUrl).mockResolvedValue(
      ENTRY.componentRef,
    );

    expect(await loadPipelineByName(NAME)).toEqual({
      experiment: {
        componentRef: ENTRY.componentRef,
        spec: ENTRY.componentRef.spec,
      },
      isLoading: false,
      error: null,
    });
  });

  it("keeps unrelated storage failures generic", async () => {
    vi.spyOn(pipelineStorageDb.pipeline_registry, "where").mockImplementation(
      () => {
        throw new Error("Internal database details");
      },
    );

    expect(await loadPipelineByName(NAME)).toEqual({
      experiment: null,
      isLoading: false,
      error: "Error loading pipeline",
    });
  });
});
