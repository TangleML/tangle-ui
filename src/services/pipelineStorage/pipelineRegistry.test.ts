import "fake-indexeddb/auto";

import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pipelineStorageDb } from "./db";
import {
  assertStorageKeyUnique,
  claimEntry,
  findById,
  findByStorageKey,
  getAllByFolderId,
} from "./pipelineRegistry";
import { resetStorageModeForTests } from "./storageMode";
import { ROOT_FOLDER_ID } from "./types";

function useStore(kind: "local" | "backend") {
  vi.stubEnv(
    "VITE_PIPELINE_STORAGE_BETA",
    kind === "backend" ? "true" : "false",
  );
  resetStorageModeForTests();
}

beforeEach(async () => {
  await pipelineStorageDb.pipeline_registry.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetStorageModeForTests();
});

describe("registry rows belong to the store that wrote them", () => {
  it("hides a backend row from browser storage, and the other way round", async () => {
    useStore("backend");
    await claimEntry({
      id: "external-1",
      storageKey: "Churn model",
      folderId: ROOT_FOLDER_ID,
    });

    useStore("local");
    expect(await findById("external-1")).toBeUndefined();
    expect(await findByStorageKey("Churn model")).toBeUndefined();
    expect(await getAllByFolderId(ROOT_FOLDER_ID)).toEqual([]);

    await claimEntry({
      id: "local-1",
      storageKey: "Churn model",
      folderId: ROOT_FOLDER_ID,
    });

    useStore("backend");
    expect(await findById("local-1")).toBeUndefined();
    expect((await findByStorageKey("Churn model"))?.id).toBe("external-1");
  });

  it("lets both stores hold a pipeline of the same name", async () => {
    useStore("local");
    await claimEntry({
      id: "local-1",
      storageKey: "Churn model",
      folderId: ROOT_FOLDER_ID,
    });

    useStore("backend");
    await expect(
      claimEntry({
        id: "external-1",
        storageKey: "Churn model",
        folderId: ROOT_FOLDER_ID,
      }),
    ).resolves.toMatchObject({ id: "external-1" });

    expect(await pipelineStorageDb.pipeline_registry.count()).toBe(2);
  });

  it("does not refuse a name only the other store is using", async () => {
    useStore("backend");
    await claimEntry({
      id: "external-1",
      storageKey: "Churn model",
      folderId: ROOT_FOLDER_ID,
    });

    useStore("local");
    await expect(
      assertStorageKeyUnique("Churn model"),
    ).resolves.toBeUndefined();

    await claimEntry({
      id: "local-1",
      storageKey: "Churn model",
      folderId: ROOT_FOLDER_ID,
    });
    await expect(assertStorageKeyUnique("Churn model")).rejects.toThrow(
      /already exists/,
    );
  });

  it("still claims a key once when two listings race", async () => {
    useStore("local");

    const [first, second] = await Promise.all([
      claimEntry({
        id: "first",
        storageKey: "Churn model",
        folderId: ROOT_FOLDER_ID,
      }),
      claimEntry({
        id: "second",
        storageKey: "Churn model",
        folderId: ROOT_FOLDER_ID,
      }),
    ]);

    expect(first.id).toBe(second.id);
    expect(await pipelineStorageDb.pipeline_registry.count()).toBe(1);
  });
});

describe("rows left by an earlier name for the same store", () => {
  const V7_SCHEMA = {
    pipeline_registry:
      "id, storage, folderId, &[storage+storageKey], [storage+folderId], [storage+folderId+storageKey]",
    folders: "id, parentId",
    pipeline_specs: "[storage+storageKey]",
    host_migration: "id",
  };

  async function openAtV7() {
    await pipelineStorageDb.close();
    await Dexie.delete("tangle_pipelines");
    const old = new Dexie("tangle_pipelines");
    old.version(7).stores(V7_SCHEMA);
    await old.open();
    return old;
  }

  it("reads them as the store they always described", async () => {
    const old = await openAtV7();
    await old.table("pipeline_registry").bulkAdd([
      {
        id: "external-1",
        storage: "host",
        storageKey: "Churn model",
        folderId: ROOT_FOLDER_ID,
      },
    ]);
    old.close();

    await pipelineStorageDb.open();

    expect(
      (await pipelineStorageDb.pipeline_registry.get("external-1"))?.storage,
    ).toBe("backend");
  });

  it("keeps the newer row when a listing had already claimed the key", async () => {
    const old = await openAtV7();
    await old.table("pipeline_registry").bulkAdd([
      {
        id: "stale",
        storage: "host",
        storageKey: "Churn model",
        folderId: ROOT_FOLDER_ID,
      },
      {
        id: "fresh",
        storage: "backend",
        storageKey: "Churn model",
        folderId: ROOT_FOLDER_ID,
      },
    ]);
    old.close();

    await pipelineStorageDb.open();

    expect(
      (await pipelineStorageDb.pipeline_registry.toArray()).map(
        (row) => row.id,
      ),
    ).toEqual(["fresh"]);
  });
});

describe("attributing rows written before rows said which store", () => {
  const OLD_SCHEMA = {
    pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
    folders: "id, parentId",
    pipeline_specs: "storageKey",
    host_migration: "id",
  };

  it("reads a backend row by its reported version and a filed row by its folder", async () => {
    await pipelineStorageDb.close();
    await Dexie.delete("tangle_pipelines");

    const old = new Dexie("tangle_pipelines");
    old.version(5).stores(OLD_SCHEMA);
    await old.open();
    await old.table("pipeline_registry").bulkAdd([
      { id: "external-1", storageKey: "Churn model", folderId: ROOT_FOLDER_ID },
      {
        id: "local-1",
        storageKey: "Nightly refresh",
        folderId: ROOT_FOLDER_ID,
      },
      { id: "filed-1", storageKey: "Ranking model", folderId: "folder-1" },
    ]);
    await old
      .table("pipeline_registry")
      .update("external-1", { contentVersion: "v7" });
    old.close();

    await pipelineStorageDb.open();

    const attributed = await pipelineStorageDb.pipeline_registry.toArray();
    expect(
      Object.fromEntries(attributed.map((row) => [row.id, row.storage])),
    ).toEqual({
      "external-1": "backend",
      "local-1": "local",
      "filed-1": "local",
    });
  });
});
