import { describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/models/componentSpec";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

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
  });
});
