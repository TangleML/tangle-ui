import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  loadUndoHistory,
  saveIdStack,
  saveUndoHistory,
} from "./undoHistoryStorage";

describe("undoHistoryStorage idStack persistence", () => {
  beforeEach(async () => {
    // Isolate each test: clear anything a previous case wrote.
    await saveIdStack("cleanup", []);
  });

  it("saveIdStack persists an idStack with no undo events", async () => {
    await saveIdStack("pipeline-a", ["task_1", "spec_1"]);

    const loaded = await loadUndoHistory("pipeline-a");
    expect(loaded).not.toBeNull();
    expect(loaded?.idStack).toEqual(["task_1", "spec_1"]);
    expect(loaded?.undoEvents).toEqual([]);
  });

  it("loadUndoHistory returns a record even when undoEvents is empty", async () => {
    await saveIdStack("pipeline-b", ["input_1", "spec_1"]);

    const loaded = await loadUndoHistory("pipeline-b");
    expect(loaded?.idStack).toEqual(["input_1", "spec_1"]);
  });

  it("saveIdStack preserves previously stored undo events", async () => {
    await saveUndoHistory("pipeline-c", ["task_1", "spec_1"], {
      undoQueue: [{ type: "test" }],
    } as never);

    await saveIdStack("pipeline-c", ["task_2", "spec_1"]);

    const loaded = await loadUndoHistory("pipeline-c");
    expect(loaded?.idStack).toEqual(["task_2", "spec_1"]);
    expect(loaded?.undoEvents).toHaveLength(1);
  });

  it("returns null when no idStack was ever stored", async () => {
    const loaded = await loadUndoHistory("pipeline-missing");
    expect(loaded).toBeNull();
  });
});
