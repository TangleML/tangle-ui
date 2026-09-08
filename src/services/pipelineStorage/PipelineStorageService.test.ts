import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineStorageHost } from "./host/contract";
import { PipelineStorageService } from "./PipelineStorageService";
import { resetStorageModeForTests } from "./storageMode";
import { HOST_DRIVER_TYPE, ROOT_FOLDER_ID } from "./types";

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

function installHost(): void {
  const host: PipelineStorageHost = {
    version: 1,
    label: LABEL,
    list: async () => [],
    read: async () => {
      throw new Error("not seeded");
    },
    write: async () => {
      throw new Error("not seeded");
    },
    delete: async () => undefined,
    has: async () => false,
  };

  Object.defineProperty(window, "__TANGLE_PIPELINE_STORAGE_HOST__", {
    value: host,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
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
