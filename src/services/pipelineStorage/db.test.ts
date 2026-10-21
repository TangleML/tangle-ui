import "fake-indexeddb/auto";

import { Dexie } from "dexie";
import { expect, it, vi } from "vitest";

vi.mock("@/utils/componentStore", () => ({
  getAllComponentFilesFromList: async () => new Map([["Original", {}]]),
}));

it("recognizes stale raw files while rebuilding an empty registry after restart", async () => {
  const seed = new Dexie("tangle_pipelines");
  seed.version(3).stores({
    pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
    folders: "id, parentId",
    pipeline_migrations: "key",
    pipeline_migration_attempts: "localId",
  });
  await seed.table("pipeline_migrations").put({
    key: "name:Original",
    localId: "old-local-id",
    name: "Original",
    remote: {
      source: "remote",
      backendUrl: "https://backend.example.com",
      pipelineId: "remote-id",
    },
  });
  seed.close();
  const { pipelineStorageDb } = await import("./db");
  try {
    expect(await pipelineStorageDb.pipeline_registry.toArray()).toEqual([
      expect.objectContaining({
        storageKey: "Original",
        recreatedAfterMigration: true,
      }),
    ]);
  } finally {
    await pipelineStorageDb.delete();
  }
});
