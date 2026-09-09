import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { pipelineStorageDb } from "./db";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import {
  claimHostMigration,
  dismissHostMigration,
  readHostMigration,
  runHostMigration,
} from "./hostMigration";
import { PipelineFolder } from "./PipelineFolder";
import { ROOT_FOLDER_ID } from "./types";

const LOCAL = ["Churn model", "Nightly refresh", "Ranking model"];

function seedLocalStore(names: string[] = LOCAL) {
  vi.spyOn(RootFolderDbStorageDriver.prototype, "list").mockResolvedValue(
    names.map((storageKey) => ({ storageKey })),
  );
  vi.spyOn(RootFolderDbStorageDriver.prototype, "read").mockImplementation(
    async (storageKey: string) => `name: ${storageKey}\n`,
  );
}

function hostFolder(options: { rejects?: Set<string> } = {}) {
  const written = new Map<string, string>();

  const folder = new PipelineFolder({
    id: ROOT_FOLDER_ID,
    name: "Shared storage",
    parentId: null,
    isFlat: true,
    driver: {
      type: "host",
      allowsMoveIn: false,
      allowsMoveOut: false,
      listingIsAuthoritative: true,
      list: async () => [],
      read: async () => "",
      write: async (storageKey: string, content: string) => {
        if (options.rejects?.has(storageKey)) {
          throw new Error(`refused ${storageKey}`);
        }
        written.set(storageKey, content);
        return { storageKey, externalId: `external-${storageKey}` };
      },
      delete: async () => undefined,
      hasKey: async (storageKey: string) => written.has(storageKey),
    },
  });

  return { folder, written };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await pipelineStorageDb.host_migration.clear();
  await pipelineStorageDb.pipeline_registry.clear();
});

describe("claiming the migration", () => {
  it("lets exactly one of two tabs starting together do the work", async () => {
    const claims = await Promise.all([
      claimHostMigration(),
      claimHostMigration(),
    ]);

    expect(claims.filter((claim) => claim === "claimed")).toHaveLength(1);
    expect(claims.filter((claim) => claim === "in-progress")).toHaveLength(1);
  });

  it("takes over from a tab that claimed and then died", async () => {
    await claimHostMigration();
    await pipelineStorageDb.host_migration.update("v1", {
      startedAt: Date.now() - 10 * 60_000,
    });

    expect(await claimHostMigration()).toBe("claimed");
  });

  it("does not run again once it has finished", async () => {
    seedLocalStore([]);
    await claimHostMigration();
    await runHostMigration(hostFolder().folder);

    expect(await claimHostMigration()).toBe("settled");
  });

  it("does not run again once the user has chosen to go without", async () => {
    await claimHostMigration();
    await dismissHostMigration();

    expect(await claimHostMigration()).toBe("settled");
  });
});

describe("running the migration", () => {
  it("copies every browser-stored pipeline under the name it already had", async () => {
    seedLocalStore();
    const { folder, written } = hostFolder();

    const record = await runHostMigration(folder);

    expect([...written.keys()].sort()).toEqual([...LOCAL].sort());
    expect(record.failed).toEqual([]);
    expect(record.completedAt).toBeDefined();
  });

  it("reports what it could not copy and stays unfinished", async () => {
    seedLocalStore();
    const { folder, written } = hostFolder({
      rejects: new Set(["Ranking model"]),
    });

    const record = await runHostMigration(folder);

    expect(record.failed).toEqual(["Ranking model"]);
    expect(record.completedAt).toBeUndefined();
    expect(written.size).toBe(2);
  });

  it("retries only what failed", async () => {
    seedLocalStore();
    await runHostMigration(
      hostFolder({ rejects: new Set(["Ranking model"]) }).folder,
    );

    const { folder, written } = hostFolder();
    const record = await runHostMigration(folder);

    expect([...written.keys()]).toEqual(["Ranking model"]);
    expect(record.completedAt).toBeDefined();
  });

  it("leaves the browser's own store untouched", async () => {
    seedLocalStore();
    const deleted = vi.spyOn(RootFolderDbStorageDriver.prototype, "delete");

    await runHostMigration(hostFolder().folder);

    expect(deleted).not.toHaveBeenCalled();
  });

  it("reports progress as it goes", async () => {
    seedLocalStore();
    const seen: number[] = [];

    await runHostMigration(hostFolder().folder, ({ copied }) =>
      seen.push(copied),
    );

    expect(seen.at(0)).toBe(0);
    expect(seen.at(-1)).toBe(LOCAL.length);
  });

  it("survives being run twice without duplicating anything", async () => {
    seedLocalStore();
    await runHostMigration(hostFolder().folder);

    const { folder, written } = hostFolder();
    await runHostMigration(folder);

    expect(written.size).toBe(0);
    expect((await readHostMigration())?.copied.sort()).toEqual(
      [...LOCAL].sort(),
    );
  });
});
