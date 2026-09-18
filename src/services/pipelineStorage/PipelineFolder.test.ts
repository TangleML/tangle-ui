import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type PipelineFileChange,
  subscribePipelineFileChanged,
} from "./pipelineFileEvents";
import { PipelineFolder } from "./PipelineFolder";
import {
  type PipelineFileDescriptor,
  type PipelineRegistryEntry,
  type PipelineStorageDriver,
  ROOT_FOLDER_ID,
} from "./types";

const registry = vi.hoisted(() => new Map<string, PipelineRegistryEntry>());

vi.mock("./db", () => ({ pipelineStorageDb: { folders: {} } }));

vi.mock("./createDriver", () => ({
  createDriver: () => {
    throw new Error("createDriver should not be reached in these tests");
  },
}));

vi.mock("./pipelineRegistry", () => ({
  claimEntry: vi.fn(async (entry: PipelineRegistryEntry) => {
    const existing = [...registry.values()].find(
      (candidate) => candidate.storageKey === entry.storageKey,
    );
    if (existing) return existing;

    registry.set(entry.id, entry);
    return entry;
  }),
  updateEntry: vi.fn(
    async (id: string, changes: Partial<PipelineRegistryEntry>) => {
      const existing = registry.get(id);
      if (existing) registry.set(id, { ...existing, ...changes });
    },
  ),
  deleteEntry: vi.fn(async (id: string) => {
    registry.delete(id);
  }),
  findById: vi.fn(async (id: string) => registry.get(id)),
  findByStorageKey: vi.fn(async (storageKey: string) =>
    [...registry.values()].find((entry) => entry.storageKey === storageKey),
  ),
  getAllByFolderId: vi.fn(async (folderId: string) =>
    [...registry.values()].filter((entry) => entry.folderId === folderId),
  ),
  assertStorageKeyUnique: vi.fn(async (storageKey: string) => {
    const clash = [...registry.values()].some(
      (entry) => entry.storageKey === storageKey,
    );
    if (clash) throw new Error(`Storage key already in use: ${storageKey}`);
  }),
  deleteFoldersAndDetachEntries: vi.fn(async () => undefined),
}));

interface FakeDriverOptions {
  listingIsAuthoritative?: boolean;
  write?: (
    storageKey: string,
    content: string,
  ) => Promise<PipelineFileDescriptor>;
  canRename?: boolean;
}

interface FakeDriver extends PipelineStorageDriver {
  descriptors: PipelineFileDescriptor[];
  contents: Map<string, string>;
}

function createFakeDriver(options: FakeDriverOptions = {}): FakeDriver {
  const contents = new Map<string, string>();
  const descriptors: PipelineFileDescriptor[] = [];

  return {
    type: "fake",
    allowsMoveIn: true,
    allowsMoveOut: true,
    listingIsAuthoritative: options.listingIsAuthoritative,
    descriptors,
    contents,
    async list() {
      return descriptors;
    },
    async read(storageKey: string) {
      return contents.get(storageKey) ?? "";
    },
    write:
      options.write ??
      (async (storageKey: string, content: string) => {
        contents.set(storageKey, content);
        return { storageKey };
      }),
    rename:
      options.canRename === false
        ? undefined
        : async (oldStorageKey: string, newStorageKey: string) => {
            const content = contents.get(oldStorageKey);
            contents.delete(oldStorageKey);
            if (content !== undefined) contents.set(newStorageKey, content);
          },
    async delete(storageKey: string) {
      contents.delete(storageKey);
    },
    async hasKey(storageKey: string) {
      return contents.has(storageKey);
    },
  };
}

function createFolder(driver: PipelineStorageDriver): PipelineFolder {
  return new PipelineFolder({
    id: ROOT_FOLDER_ID,
    name: "Pipelines",
    parentId: null,
    driver,
  });
}

const unsubscribes: (() => void)[] = [];

function collectChanges(): PipelineFileChange[] {
  const changes: PipelineFileChange[] = [];
  unsubscribes.push(
    subscribePipelineFileChanged((change) => changes.push(change)),
  );
  return changes;
}

beforeEach(() => {
  registry.clear();
});

afterEach(() => {
  unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
});

describe("PipelineFolder.addFile", () => {
  it("adopts the identity the driver reports for the new file", async () => {
    const folder = createFolder(
      createFakeDriver({
        write: async (storageKey) => ({
          storageKey,
          externalId: "external-1",
          displayName: "Churn model",
          contentVersion: "v1",
        }),
      }),
    );

    const file = await folder.addFile("opaque-key", "name: Churn model");

    expect(file.id).toBe("external-1");
    expect(file.displayName).toBe("Churn model");
    expect(registry.get("external-1")).toEqual({
      id: "external-1",
      storageKey: "opaque-key",
      folderId: ROOT_FOLDER_ID,
      contentVersion: "v1",
    });
  });

  it("mints an id when the driver reports no identity of its own", async () => {
    const folder = createFolder(createFakeDriver());

    const file = await folder.addFile("my-pipeline", "name: My pipeline");

    expect(file.id).not.toBe("my-pipeline");
    expect(registry.get(file.id)).toMatchObject({
      storageKey: "my-pipeline",
      contentVersion: undefined,
    });
  });

  it("registers the key the driver actually wrote, not the one requested", async () => {
    const folder = createFolder(
      createFakeDriver({
        write: async () => ({ storageKey: "assigned-by-store" }),
      }),
    );

    const file = await folder.addFile("requested", "name: Requested");

    expect(file.storageKey).toBe("assigned-by-store");
    expect(registry.get(file.id)?.storageKey).toBe("assigned-by-store");
  });

  it("leaves no registry entry behind when the write is rejected", async () => {
    const folder = createFolder(
      createFakeDriver({
        write: async () => {
          throw new Error("quota exceeded");
        },
      }),
    );

    await expect(folder.addFile("rejected", "name: Rejected")).rejects.toThrow(
      "quota exceeded",
    );

    expect(registry.size).toBe(0);
  });
});

describe("PipelineFolder.listPipelines", () => {
  it("keeps ids stable across repeated listings", async () => {
    const driver = createFakeDriver();
    driver.descriptors.push({ storageKey: "key-1", externalId: "external-1" });
    const folder = createFolder(driver);

    const [first] = await folder.listPipelines();
    const [second] = await folder.listPipelines();

    expect(first.id).toBe("external-1");
    expect(second.id).toBe("external-1");
    expect(registry.size).toBe(1);
  });

  it("keeps a minted id stable across repeated listings", async () => {
    const driver = createFakeDriver();
    driver.descriptors.push({ storageKey: "key-1" });
    const folder = createFolder(driver);

    const [first] = await folder.listPipelines();
    const [second] = await folder.listPipelines();

    expect(second.id).toBe(first.id);
  });

  it("carries the display name the driver reports", async () => {
    const driver = createFakeDriver();
    driver.descriptors.push({
      storageKey: "opaque-key",
      displayName: "Churn model",
    });

    const [file] = await createFolder(driver).listPipelines();

    expect(file.displayName).toBe("Churn model");
    expect(file.storageKey).toBe("opaque-key");
  });

  it("falls back to the storage key when the driver reports no name", async () => {
    const driver = createFakeDriver();
    driver.descriptors.push({ storageKey: "my-pipeline" });

    const [file] = await createFolder(driver).listPipelines();

    expect(file.displayName).toBe("my-pipeline");
  });
});

describe("PipelineFolder reconciliation", () => {
  it("drops rows an authoritative listing no longer reports", async () => {
    const driver = createFakeDriver({ listingIsAuthoritative: true });
    driver.descriptors.push({ storageKey: "key-1", externalId: "external-1" });
    const folder = createFolder(driver);
    await folder.listPipelines();

    driver.descriptors.length = 0;
    const files = await folder.listPipelines();

    expect(files).toEqual([]);
    expect(registry.size).toBe(0);
  });

  it("keeps rows a non-authoritative listing omits", async () => {
    const driver = createFakeDriver();
    driver.descriptors.push({ storageKey: "key-1", externalId: "external-1" });
    const folder = createFolder(driver);
    await folder.listPipelines();

    driver.descriptors.length = 0;
    await folder.listPipelines();

    expect(registry.has("external-1")).toBe(true);
  });

  it("announces a content version that moved elsewhere", async () => {
    const driver = createFakeDriver({ listingIsAuthoritative: true });
    driver.descriptors.push({
      storageKey: "key-1",
      externalId: "external-1",
      contentVersion: "v1",
    });
    const folder = createFolder(driver);
    await folder.listPipelines();

    const changes = collectChanges();
    driver.descriptors[0].contentVersion = "v2";
    await folder.listPipelines();

    expect(changes).toEqual([{ storageKey: "key-1", source: "remote" }]);
    expect(registry.get("external-1")?.contentVersion).toBe("v2");
  });

  it("stays quiet when the content version is unchanged", async () => {
    const driver = createFakeDriver({ listingIsAuthoritative: true });
    driver.descriptors.push({
      storageKey: "key-1",
      externalId: "external-1",
      contentVersion: "v1",
    });
    const folder = createFolder(driver);
    await folder.listPipelines();

    const changes = collectChanges();
    await folder.listPipelines();

    expect(changes).toEqual([]);
  });

  it("does not mistake our own write for a change made elsewhere", async () => {
    let revision = 0;
    const driver = createFakeDriver({
      listingIsAuthoritative: true,
      write: async (storageKey) => {
        revision += 1;
        return {
          storageKey,
          externalId: "external-1",
          contentVersion: `v${revision}`,
        };
      },
    });
    const folder = createFolder(driver);
    const file = await folder.addFile("key-1", "name: One");
    driver.descriptors.push({
      storageKey: "key-1",
      externalId: "external-1",
      contentVersion: "v1",
    });

    const changes = collectChanges();
    await file.write("name: Two");
    driver.descriptors[0].contentVersion = "v2";
    await folder.listPipelines();

    expect(changes.map((change) => change.source)).toEqual(["v2"]);
  });
});

describe("PipelineFolder.findFile", () => {
  it("returns nothing for a key the driver does not hold", async () => {
    const folder = createFolder(createFakeDriver());

    expect(await folder.findFile("missing")).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it("reuses the registry row of a key the driver holds", async () => {
    const folder = createFolder(createFakeDriver());
    const added = await folder.addFile("key-1", "name: One");

    const found = await folder.findFile("key-1");

    expect(found?.id).toBe(added.id);
    expect(registry.size).toBe(1);
  });
});

describe("PipelineFile.rename", () => {
  it("moves the key when the store names its own pipelines", async () => {
    const driver = createFakeDriver();
    const folder = createFolder(driver);
    const file = await folder.addFile("Churn model", "name: Churn model");

    await file.rename("Churn model v2");

    expect(file.storageKey).toBe("Churn model v2");
    expect([...driver.contents.keys()]).toEqual(["Churn model v2"]);
    expect(await folder.findFile("Churn model")).toBeUndefined();
  });

  it("leaves the key alone when the store keys pipelines itself", async () => {
    const driver = createFakeDriver({ canRename: false });
    const folder = createFolder(driver);
    const file = await folder.addFile("opaque-key", "name: Churn model");

    await file.rename("Churn model v2");

    expect(file.storageKey).toBe("opaque-key");
    expect([...driver.contents.keys()]).toEqual(["opaque-key"]);
  });
});

describe("emitted events", () => {
  it("does not emit a remote change for a local write", async () => {
    const folder = createFolder(createFakeDriver());
    const file = await folder.addFile("key-1", "name: One");

    const changes = collectChanges();
    await file.write("name: Two");

    expect(changes).toEqual([{ storageKey: "key-1", source: "v2" }]);
  });
});
