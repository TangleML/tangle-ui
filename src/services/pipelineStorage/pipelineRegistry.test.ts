import "fake-indexeddb/auto";

import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pipelineStorageDb } from "./db";
import type { PipelineStorageHost } from "./host/contract";
import {
  assertStorageKeyUnique,
  claimEntry,
  findById,
  findByStorageKey,
  getAllByFolderId,
} from "./pipelineRegistry";
import { resetStorageModeForTests } from "./storageMode";
import { ROOT_FOLDER_ID } from "./types";

const summary = {
  key: "",
  externalId: "",
  displayName: null,
  contentVersion: "1",
};

const host: PipelineStorageHost = {
  version: 1,
  label: "Shared storage",
  list: async () => [],
  read: async () => ({ ...summary, spec: {} }),
  write: async () => summary,
  delete: async () => undefined,
  has: async () => false,
};

function useStore(kind: "local" | "host") {
  vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", kind === "host" ? "true" : "false");
  if (kind === "host") window.__TANGLE_PIPELINE_STORAGE_HOST__ = host;
  else delete window.__TANGLE_PIPELINE_STORAGE_HOST__;
  resetStorageModeForTests();
}

beforeEach(async () => {
  await pipelineStorageDb.pipeline_registry.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.__TANGLE_PIPELINE_STORAGE_HOST__;
  resetStorageModeForTests();
});

describe("registry rows belong to the store that wrote them", () => {
  it("hides a host row from browser storage, and the other way round", async () => {
    useStore("host");
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

    useStore("host");
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

    useStore("host");
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
    useStore("host");
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

describe("attributing rows written before rows said which store", () => {
  const OLD_SCHEMA = {
    pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
    folders: "id, parentId",
    pipeline_specs: "storageKey",
    host_migration: "id",
  };

  it("reads a host row by its reported version and a filed row by its folder", async () => {
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
      "external-1": "host",
      "local-1": "local",
      "filed-1": "local",
    });
  });
});
