import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
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
  claimEntry: async (entry: PipelineRegistryEntry) => {
    const existing = [...registry.values()].find(
      (candidate) => candidate.storageKey === entry.storageKey,
    );
    if (existing) return existing;

    registry.set(entry.id, entry);
    return entry;
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

/**
 * Mirrors the two host behaviours the write paths are built on: `write` upserts
 * on the caller's key, and the displayed name comes from the written spec.
 */
function installHost(
  listing: HostPipelineSummary[] = [],
): Map<string, unknown> {
  const summaries = new Map(listing.map((entry) => [entry.key, entry]));
  const specs = new Map<string, unknown>();

  const host: PipelineStorageHost = {
    version: 1,
    label: LABEL,
    list: async () => [...summaries.values()],
    read: async (key) => {
      const found = summaries.get(key);
      if (!found) throw new Error(`not seeded: ${key}`);
      return { ...found, spec: specs.get(key) };
    },
    write: async (key, spec) => {
      specs.set(key, spec);
      const written = {
        ...summary(key, (spec as { name?: string }).name ?? "Untitled"),
        contentVersion: String(summaries.size + 1),
      };
      summaries.set(key, written);
      return written;
    },
    delete: async (key) => {
      summaries.delete(key);
      specs.delete(key);
    },
    has: async (key) => summaries.has(key),
  };

  Object.defineProperty(window, "__TANGLE_PIPELINE_STORAGE_HOST__", {
    value: host,
    configurable: true,
    writable: true,
  });

  return specs;
}

const PIPELINE_YAML = (name: string) =>
  `name: ${name}\nimplementation:\n  graph:\n    tasks: {}\n`;

beforeEach(() => {
  registry.clear();
  resetStorageModeForTests();
});

afterEach(() => {
  delete window.__TANGLE_PIPELINE_STORAGE_HOST__;
  resetStorageModeForTests();
  vi.restoreAllMocks();
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

describe("the flat list of everything", () => {
  it("reads the whole browser store, not just the pipelines left in the root", async () => {
    const listed = vi.fn(async () => [
      { storageKey: "In the root" },
      { storageKey: "Filed away" },
    ]);
    vi.spyOn(RootFolderDbStorageDriver.prototype, "list").mockImplementation(
      listed,
    );
    registry.set("filed", {
      id: "filed",
      storageKey: "Filed away",
      folderId: "folder-1",
    });

    const files = await new PipelineStorageService().listAllPipelines();

    expect(files.map((file) => file.storageKey)).toEqual([
      "In the root",
      "Filed away",
    ]);
    expect(registry.get("filed")?.folderId).toBe("folder-1");
  });

  it("asks a host for its listing rather than the browser store", async () => {
    installHost([summary("opaque-key-1", "Churn model")]);
    const listed = vi.spyOn(RootFolderDbStorageDriver.prototype, "list");

    const files = await new PipelineStorageService().listAllPipelines();

    expect(files.map((file) => file.displayName)).toEqual(["Churn model"]);
    expect(listed).not.toHaveBeenCalled();
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

describe("writing to a host", () => {
  it("creates a pipeline and registers the identity the store reported", async () => {
    installHost();
    const service = new PipelineStorageService();

    const file = await service.createPipeline(
      "Churn model",
      PIPELINE_YAML("Churn model"),
    );

    expect(file.id).toBe("id-Churn model");
    expect(file.displayName).toBe("Churn model");
    expect(await service.rootFolder.listPipelines()).toHaveLength(1);
  });

  it("saves over the pipeline that already has the name", async () => {
    const specs = installHost();
    const service = new PipelineStorageService();

    await service.createPipeline("Churn model", PIPELINE_YAML("Churn model"));
    await service.savePipelineByName(
      "Churn model",
      PIPELINE_YAML("Churn model"),
    );

    expect(await service.rootFolder.listPipelines()).toHaveLength(1);
    expect(specs.size).toBe(1);
  });

  it("creates a pipeline when saving a name the store has never held", async () => {
    installHost();
    const service = new PipelineStorageService();

    const file = await service.savePipelineByName(
      "Ranking model",
      PIPELINE_YAML("Ranking model"),
    );

    expect(file.displayName).toBe("Ranking model");
  });

  it("deletes through the driver so the store loses the pipeline too", async () => {
    installHost();
    const service = new PipelineStorageService();

    await service.createPipeline("Churn model", PIPELINE_YAML("Churn model"));
    await service.deletePipelineByName("Churn model");

    expect(await service.rootFolder.listPipelines()).toEqual([]);
    expect(registry.size).toBe(0);
  });

  it("renames in place rather than leaving a copy under the old name", async () => {
    installHost();
    const service = new PipelineStorageService();
    const created = await service.createPipeline(
      "Churn model",
      PIPELINE_YAML("Churn model"),
    );

    const renamed = await service.renamePipelineByName(
      "Churn model",
      "Churn model v2",
      PIPELINE_YAML("Churn model v2"),
    );

    expect(renamed.storageKey).toBe(created.storageKey);
    const listed = await service.rootFolder.listPipelines();
    expect(listed.map((file) => file.displayName)).toEqual(["Churn model v2"]);
  });

  it("creates the pipeline when renaming one the store does not hold", async () => {
    installHost();
    const service = new PipelineStorageService();

    const file = await service.renamePipelineByName(
      "Churn model",
      "Churn model v2",
      PIPELINE_YAML("Churn model v2"),
    );

    expect(file.displayName).toBe("Churn model v2");
    expect(await service.rootFolder.listPipelines()).toHaveLength(1);
  });

  it("leaves the store alone when asked to delete a name it does not hold", async () => {
    installHost([summary("opaque-key-1", "Churn model")]);
    const service = new PipelineStorageService();

    await expect(
      service.deletePipelineByName("Ranking model"),
    ).resolves.toBeUndefined();
    expect(await service.rootFolder.listPipelines()).toHaveLength(1);
  });
});
