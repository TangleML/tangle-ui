import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HostPipelineSummary, PipelineStorageHost } from "./host/contract";
import {
  AmbiguousPipelineNameError,
  PipelineNotFoundError,
  PipelineStorageService,
} from "./PipelineStorageService";
import { resetStorageModeForTests } from "./storageMode";
import {
  HOST_DRIVER_TYPE,
  type PipelineRegistryEntry,
  ROOT_FOLDER_ID,
} from "./types";

const registry = new Map<string, PipelineRegistryEntry>();

vi.mock("./pipelineRegistry", () => ({
  addEntry: async (entry: PipelineRegistryEntry) => {
    registry.set(entry.id, entry);
  },
  updateEntry: async (id: string, updates: Partial<PipelineRegistryEntry>) => {
    const entry = registry.get(id);
    if (entry) registry.set(id, { ...entry, ...updates });
  },
  deleteEntry: async (id: string) => {
    registry.delete(id);
  },
  findById: async (id: string) => registry.get(id),
  findByStorageKey: async (storageKey: string) =>
    [...registry.values()].find((entry) => entry.storageKey === storageKey),
  getAllByFolderId: async (folderId: string) =>
    [...registry.values()].filter((entry) => entry.folderId === folderId),
  assertStorageKeyUnique: async () => undefined,
}));

vi.mock("./db", () => ({
  pipelineStorageDb: {
    folders: {
      toArray: async () => [
        {
          id: "folder-1",
          name: "My folder",
          parentId: ROOT_FOLDER_ID,
          driverConfig: { driverType: "folder-indexdb", folderId: "folder-1" },
          createdAt: 0,
          favorite: true,
        },
      ],
      filter: (predicate: (entry: { favorite?: boolean }) => boolean) => ({
        toArray: async () =>
          [
            {
              id: "folder-1",
              name: "My folder",
              parentId: ROOT_FOLDER_ID,
              driverConfig: {
                driverType: "folder-indexdb",
                folderId: "folder-1",
              },
              createdAt: 0,
              favorite: true,
            },
          ].filter(predicate),
      }),
    },
  },
}));

const LABEL = "Shared storage";

function summary(key: string, displayName: string): HostPipelineSummary {
  return {
    key,
    externalId: `id-${key}`,
    displayName,
    contentVersion: "1",
  };
}

function installHost(listing: HostPipelineSummary[] = []): void {
  const host: PipelineStorageHost = {
    version: 1,
    label: LABEL,
    list: async () => listing,
    read: async () => {
      throw new Error("not seeded");
    },
    write: async () => {
      throw new Error("not seeded");
    },
    delete: async () => undefined,
    has: async (key) => listing.some((entry) => entry.key === key),
  };

  Object.defineProperty(window, "__TANGLE_PIPELINE_STORAGE_HOST__", {
    value: host,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  registry.clear();
  resetStorageModeForTests();
});

afterEach(() => {
  delete window.__TANGLE_PIPELINE_STORAGE_HOST__;
  resetStorageModeForTests();
});

describe("with no host on the page", () => {
  it("keeps browser storage as the root", () => {
    const service = new PipelineStorageService();

    expect(service.mode).toEqual({ kind: "local" });
    expect(service.rootFolder.driver.type).not.toBe(HOST_DRIVER_TYPE);
    expect(service.rootFolder.isFlat).toBe(false);
  });

  it("still resolves folders", async () => {
    const service = new PipelineStorageService();

    expect(await service.getAllFolders()).toHaveLength(1);
    expect(await service.getFavoriteFolders()).toHaveLength(1);
  });
});

describe("with a host on the page", () => {
  beforeEach(() => {
    installHost();
  });

  it("makes the host the only store, under the host's own label", () => {
    const service = new PipelineStorageService();

    expect(service.mode).toEqual({ kind: "host", label: LABEL });
    expect(service.rootFolder.id).toBe(ROOT_FOLDER_ID);
    expect(service.rootFolder.driver.type).toBe(HOST_DRIVER_TYPE);
    expect(service.rootFolder.name).toBe(LABEL);
  });

  it("reports no folders rather than browser-stored ones", async () => {
    const service = new PipelineStorageService();

    expect(await service.getAllFolders()).toEqual([]);
    expect(await service.getFavoriteFolders()).toEqual([]);
    expect(await service.rootFolder.listSubfolders()).toEqual([]);
  });

  it("refuses to open a folder left over from browser storage", async () => {
    const service = new PipelineStorageService();

    await expect(service.findFolderById("folder-1")).rejects.toThrow();
  });

  it("refuses to create a folder", async () => {
    const service = new PipelineStorageService();

    await expect(
      service.rootFolder.createSubfolder({ name: "New folder" }),
    ).rejects.toThrow();
  });

  it("stays on the host even if the host global disappears mid-session", () => {
    const service = new PipelineStorageService();
    delete window.__TANGLE_PIPELINE_STORAGE_HOST__;

    expect(new PipelineStorageService().mode).toEqual(service.mode);
  });
});

describe("resolving a route reference against a host", () => {
  it("opens the pipeline whose key the route carries", async () => {
    installHost([summary("opaque-key-1", "Churn model")]);

    const file = await new PipelineStorageService().resolve({
      name: "opaque-key-1",
    });

    expect(file.storageKey).toBe("opaque-key-1");
  });

  it("opens a pipeline by its displayed name when only one has it", async () => {
    installHost([
      summary("opaque-key-1", "Churn model"),
      summary("opaque-key-2", "Ranking model"),
    ]);

    const file = await new PipelineStorageService().resolve({
      name: "Ranking model",
    });

    expect(file.storageKey).toBe("opaque-key-2");
  });

  it("refuses to guess between pipelines sharing a name", async () => {
    installHost([
      summary("opaque-key-1", "Churn model"),
      summary("opaque-key-2", "Churn model"),
    ]);

    await expect(
      new PipelineStorageService().resolve({ name: "Churn model" }),
    ).rejects.toThrow(AmbiguousPipelineNameError);
  });

  it("reports a missing pipeline rather than reaching for browser storage", async () => {
    installHost([summary("opaque-key-1", "Churn model")]);

    await expect(
      new PipelineStorageService().resolve({ name: "Churn model v2" }),
    ).rejects.toThrow(PipelineNotFoundError);
  });

  it("finds a pipeline the registry has never seen by its id", async () => {
    installHost([summary("opaque-key-1", "Churn model")]);

    const file = await new PipelineStorageService().resolve({
      name: "whatever-the-link-said",
      fileId: "id-opaque-key-1",
    });

    expect(file.storageKey).toBe("opaque-key-1");
  });
});
