import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setBackendEndpoint } from "./backendEndpoint";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import type { NewPipelineRegistryEntry } from "./pipelineRegistry";
import {
  AmbiguousPipelineNameError,
  PipelineNotFoundError,
  PipelineStorageService,
} from "./PipelineStorageService";
import { resetStorageModeForTests } from "./storageMode";
import {
  BACKEND_DRIVER_TYPE,
  type PipelineRegistryEntry,
  ROOT_FOLDER_ID,
} from "./types";

const registry = new Map<string, PipelineRegistryEntry>();

vi.mock("./pipelineRegistry", () => ({
  claimEntry: async (entry: NewPipelineRegistryEntry) => {
    const existing = [...registry.values()].find(
      (candidate) => candidate.storageKey === entry.storageKey,
    );
    if (existing) return existing;

    const row = { storage: "local" as const, ...entry };
    registry.set(row.id, row);
    return row;
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

const LABEL = "Backend";

interface StoredRow {
  id: string;
  file_path: string;
  pipeline_name: string;
  current_version: string;
  root_pipeline_task: { componentRef: { spec: unknown } };
}

function summary(key: string, displayName: string): StoredRow {
  return {
    id: `id-${key}`,
    file_path: key,
    pipeline_name: displayName,
    current_version: "1",
    root_pipeline_task: { componentRef: { spec: {} } },
  };
}

const ENDPOINT = "https://backend.test";

/**
 * Answers the pipeline routes out of a map, mirroring the two behaviours the
 * write paths are built on: a write upserts on the key it is given, and the
 * displayed name comes from the spec that was written.
 *
 * The backend holds pipelines only when the deployment asks it to, so turning
 * the beta on is part of installing this.
 */
function installBackend(listing: StoredRow[] = []): Map<string, unknown> {
  vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "true");
  setBackendEndpoint(ENDPOINT);

  const rows = new Map(listing.map((row) => [row.file_path, row]));
  const specs = new Map<string, unknown>(
    listing.map((row) => [
      row.file_path,
      row.root_pipeline_task.componentRef.spec,
    ]),
  );

  const answer = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );

  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const key = url.searchParams.get("file_path") ?? "";
      const isList = url.pathname.endsWith("/all");

      if (isList) {
        const matched = [...rows.values()].filter(
          (row) => !key || row.file_path === key,
        );
        return answer({ pipelines: matched, next_page_token: null });
      }

      switch (init?.method) {
        case "PUT": {
          const sent = JSON.parse(String(init.body)) as {
            root_pipeline_task: { componentRef: { spec: { name?: string } } };
          };
          const spec = sent.root_pipeline_task.componentRef.spec;
          specs.set(key, spec);
          const written: StoredRow = {
            ...summary(key, spec.name ?? "Untitled"),
            current_version: String(rows.size + 1),
            root_pipeline_task: { componentRef: { spec } },
          };
          rows.set(key, written);
          return answer(written);
        }
        case "DELETE":
          rows.delete(key);
          specs.delete(key);
          return answer(null, 204);
        default: {
          const found = rows.get(key);
          if (!found) return answer({ detail: "not found" }, 404);
          return answer({
            ...found,
            root_pipeline_task: { componentRef: { spec: specs.get(key) } },
          });
        }
      }
    },
  );

  return specs;
}

const PIPELINE_YAML = (name: string) =>
  `name: ${name}\nimplementation:\n  graph:\n    tasks: {}\n`;

beforeEach(() => {
  registry.clear();
  resetStorageModeForTests();
});

afterEach(() => {
  setBackendEndpoint("");
  vi.unstubAllEnvs();
  resetStorageModeForTests();
  vi.restoreAllMocks();
});

describe("with the beta off", () => {
  it("keeps browser storage as the root", () => {
    const service = new PipelineStorageService();

    expect(service.mode).toEqual({ kind: "local" });
    expect(service.rootFolder.driver.type).not.toBe(BACKEND_DRIVER_TYPE);
    expect(service.rootFolder.isFlat).toBe(false);
  });

  it("still resolves folders", async () => {
    const service = new PipelineStorageService();

    expect(await service.getAllFolders()).toHaveLength(1);
    expect(await service.getFavoriteFolders()).toHaveLength(1);
  });
});

describe("with the beta on", () => {
  beforeEach(() => {
    installBackend();
  });

  it("makes the backend the only store", () => {
    const service = new PipelineStorageService();

    expect(service.mode).toEqual({ kind: "backend", label: LABEL });
    expect(service.rootFolder.id).toBe(ROOT_FOLDER_ID);
    expect(service.rootFolder.driver.type).toBe(BACKEND_DRIVER_TYPE);
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
    setBackendEndpoint("");

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
      storage: "local",
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

  it("asks the backend for its listing rather than the browser store", async () => {
    installBackend([summary("opaque-key-1", "Churn model")]);
    const listed = vi.spyOn(RootFolderDbStorageDriver.prototype, "list");

    const files = await new PipelineStorageService().listAllPipelines();

    expect(files.map((file) => file.displayName)).toEqual(["Churn model"]);
    expect(listed).not.toHaveBeenCalled();
  });
});

describe("resolving a route reference against a host", () => {
  it("opens the pipeline whose key the route carries", async () => {
    installBackend([summary("opaque-key-1", "Churn model")]);

    const file = await new PipelineStorageService().resolve({
      name: "opaque-key-1",
    });

    expect(file.storageKey).toBe("opaque-key-1");
  });

  it("opens a pipeline by its displayed name when only one has it", async () => {
    installBackend([
      summary("opaque-key-1", "Churn model"),
      summary("opaque-key-2", "Ranking model"),
    ]);

    const file = await new PipelineStorageService().resolve({
      name: "Ranking model",
    });

    expect(file.storageKey).toBe("opaque-key-2");
  });

  it("refuses to guess between pipelines sharing a name", async () => {
    installBackend([
      summary("opaque-key-1", "Churn model"),
      summary("opaque-key-2", "Churn model"),
    ]);

    await expect(
      new PipelineStorageService().resolve({ name: "Churn model" }),
    ).rejects.toThrow(AmbiguousPipelineNameError);
  });

  it("reports a missing pipeline rather than reaching for browser storage", async () => {
    installBackend([summary("opaque-key-1", "Churn model")]);

    await expect(
      new PipelineStorageService().resolve({ name: "Churn model v2" }),
    ).rejects.toThrow(PipelineNotFoundError);
  });

  it("opens a pipeline from a path that carries only its id", async () => {
    installBackend([summary("opaque-key-1", "Churn model")]);

    const file = await new PipelineStorageService().resolve({
      name: "id-opaque-key-1",
      fileId: "id-opaque-key-1",
    });

    expect(file.storageKey).toBe("opaque-key-1");
  });

  it("still opens an older link whose path carries a name", async () => {
    installBackend([summary("opaque-key-1", "Churn model")]);

    const file = await new PipelineStorageService().resolve({
      name: "Churn model",
      fileId: "Churn model",
    });

    expect(file.storageKey).toBe("opaque-key-1");
  });

  it("refuses a link whose id is gone rather than opening a namesake", async () => {
    installBackend([summary("opaque-key-1", "Churn model")]);

    await expect(
      new PipelineStorageService().resolve({
        name: "Churn model",
        fileId: "id-of-a-deleted-pipeline",
      }),
    ).rejects.toThrow(PipelineNotFoundError);
  });

  it("finds a pipeline the registry has never seen by its id", async () => {
    installBackend([summary("opaque-key-1", "Churn model")]);

    const file = await new PipelineStorageService().resolve({
      name: "whatever-the-link-said",
      fileId: "id-opaque-key-1",
    });

    expect(file.storageKey).toBe("opaque-key-1");
  });
});

describe("writing to a host", () => {
  it("creates a pipeline and registers the identity the store reported", async () => {
    installBackend();
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
    const specs = installBackend();
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
    installBackend();
    const service = new PipelineStorageService();

    const file = await service.savePipelineByName(
      "Ranking model",
      PIPELINE_YAML("Ranking model"),
    );

    expect(file.displayName).toBe("Ranking model");
  });

  it("deletes through the driver so the store loses the pipeline too", async () => {
    installBackend();
    const service = new PipelineStorageService();

    await service.createPipeline("Churn model", PIPELINE_YAML("Churn model"));
    await service.deletePipelineByName("Churn model");

    expect(await service.rootFolder.listPipelines()).toEqual([]);
    expect(registry.size).toBe(0);
  });

  it("renames in place rather than leaving a copy under the old name", async () => {
    installBackend();
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
    installBackend();
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
    installBackend([summary("opaque-key-1", "Churn model")]);
    const service = new PipelineStorageService();

    await expect(
      service.deletePipelineByName("Ranking model"),
    ).resolves.toBeUndefined();
    expect(await service.rootFolder.listPipelines()).toHaveLength(1);
  });
});
