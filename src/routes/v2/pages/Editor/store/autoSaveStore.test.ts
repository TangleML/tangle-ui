import { describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/models/componentSpec";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  reportStorageAnswered,
  reportStorageFailed,
} from "@/services/pipelineStorage/storageHealth";

import { AutoSaveStore } from "./autoSaveStore";
import { PipelineFileStore } from "./pipelineFileStore";
import type { UndoStore } from "./undoStore";

vi.mock("@/models/componentSpec", () => ({
  collectIdStack: () => [],
  serializePipelineDocumentToText: (spec: { name: string }) =>
    `name: ${spec.name}`,
}));

vi.mock("@/routes/v2/pages/Editor/utils/undoHistoryStorage", () => ({
  saveUndoHistory: vi.fn(async () => undefined),
}));

function createStore(file: PipelineFile | null) {
  const fileStore = new PipelineFileStore();
  fileStore.init(file);

  const undoStore = { undoManager: null } as unknown as UndoStore;

  return new AutoSaveStore(undoStore, fileStore);
}

function createSpec(name: string): ComponentSpec {
  return { name } as unknown as ComponentSpec;
}

describe("AutoSaveStore.save", () => {
  it("writes the serialized pipeline to the open file", async () => {
    const write = vi.fn(async () => undefined);
    const store = createStore({ write } as unknown as PipelineFile);

    store.init(createSpec("Churn model"), "Churn model");
    await store.save();

    expect(write).toHaveBeenCalledWith("name: Churn model");
    expect(store.saveError).toBeNull();
    expect(store.lastSavedAt).toBeInstanceOf(Date);
  });

  it("reports a failure when there is no file to write to", async () => {
    const store = createStore(null);

    store.init(createSpec("Churn model"), "Churn model");
    await store.save();

    expect(store.saveError).not.toBeNull();
    expect(store.lastSavedAt).toBeNull();
  });

  it("surfaces the reason the write was rejected", async () => {
    const store = createStore({
      write: async () => {
        throw new Error("Shared storage could not be reached.");
      },
    } as unknown as PipelineFile);

    store.init(createSpec("Churn model"), "Churn model");
    await store.save();

    expect(store.saveError).toContain("could not be reached");
    store.dispose();
  });
});

describe("AutoSaveStore when the store cannot be reached", () => {
  it("holds on to the rejected edit rather than dropping it", async () => {
    const store = createStore({
      write: async () => {
        throw new Error("unreachable");
      },
    } as unknown as PipelineFile);

    store.init(createSpec("Churn model"), "Churn model");
    await store.save();

    expect(store.hasPendingChanges).toBe(true);
    store.dispose();
  });

  it("saves the held edit as soon as the store takes writes again", async () => {
    let reachable = false;
    const written: string[] = [];
    const store = createStore({
      write: async (yamlText: string) => {
        if (!reachable) throw new Error("unreachable");
        written.push(yamlText);
      },
    } as unknown as PipelineFile);

    store.init(createSpec("Churn model"), "Churn model");
    await store.save();
    expect(written).toEqual([]);

    reachable = true;
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(store.hasPendingChanges).toBe(false));

    expect(written).toEqual(["name: Churn model"]);
    expect(store.saveError).toBeNull();
    expect(store.lastSavedAt).toBeInstanceOf(Date);
    store.dispose();
  });

  it("saves the held edit the moment the store answers again", async () => {
    let reachable = false;
    const written: string[] = [];
    const store = createStore({
      write: async (yamlText: string) => {
        if (!reachable) throw new Error("unreachable");
        written.push(yamlText);
      },
    } as unknown as PipelineFile);

    store.init(createSpec("Churn model"), "Churn model");
    await store.save();
    reportStorageFailed("unavailable");
    expect(written).toEqual([]);

    reachable = true;
    reportStorageAnswered();

    await vi.waitFor(() => {
      expect(written).toEqual(["name: Churn model"]);
      expect(store.saveError).toBeNull();
    });
    store.dispose();
  });

  it("stops retrying once the editor is closed", async () => {
    const write = vi.fn(async () => {
      throw new Error("unreachable");
    });
    const store = createStore({ write } as unknown as PipelineFile);

    store.init(createSpec("Churn model"), "Churn model");
    await store.save();
    store.dispose();

    write.mockClear();
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(write).not.toHaveBeenCalled();
  });

  it("retries with the newest edit, never the one that was refused", async () => {
    const written: string[] = [];
    let reachable = false;
    const store = createStore({
      write: async (yamlText: string) => {
        if (!reachable) throw new Error("unreachable");
        written.push(yamlText);
      },
    } as unknown as PipelineFile);

    const spec = createSpec("Churn model");
    store.init(spec, "Churn model");
    await store.save();

    spec.name = "Churn model v2";
    reachable = true;
    await store.save();

    expect(written).toEqual(["name: Churn model v2"]);
    store.dispose();
  });

  it("does not let a retry land on top of a save that already succeeded", async () => {
    const written: string[] = [];
    let reachable = false;
    const store = createStore({
      write: async (yamlText: string) => {
        if (!reachable) throw new Error("unreachable");
        written.push(yamlText);
      },
    } as unknown as PipelineFile);

    const spec = createSpec("Churn model");
    store.init(spec, "Churn model");
    await store.save();

    reachable = true;
    spec.name = "Churn model v2";
    await store.save();

    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(written).toEqual(["name: Churn model v2"]);
    store.dispose();
  });

  it("waits for the write in flight before the parting one", async () => {
    const written: string[] = [];
    let release: (() => void) | undefined;
    const store = createStore({
      write: async (yamlText: string) => {
        if (!release) {
          await new Promise<void>((resolve) => (release = resolve));
        }
        written.push(yamlText);
      },
    } as unknown as PipelineFile);

    const spec = createSpec("Churn model");
    store.init(spec, "Churn model");

    const saving = store.save();
    spec.name = "Churn model v2";
    store.dispose();

    release?.();
    await saving;
    await vi.waitFor(() =>
      expect(written).toEqual(["name: Churn model", "name: Churn model v2"]),
    );
  });

  it("lands overlapping saves in order instead of racing them", async () => {
    const written: string[] = [];
    let release: (() => void) | undefined;
    const store = createStore({
      write: async (yamlText: string) => {
        if (!release) {
          await new Promise<void>((resolve) => (release = resolve));
        }
        written.push(yamlText);
      },
    } as unknown as PipelineFile);

    const spec = createSpec("Churn model");
    store.init(spec, "Churn model");

    const first = store.save();
    spec.name = "Churn model v2";
    const second = store.save();

    release?.();
    await Promise.all([first, second]);

    expect(written).toEqual(["name: Churn model", "name: Churn model v2"]);
    store.dispose();
  });
});
