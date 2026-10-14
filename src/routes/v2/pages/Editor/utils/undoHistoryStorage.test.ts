import "fake-indexeddb/auto";

import { undoMiddleware } from "mobx-keystone";
import { beforeEach, describe, expect, it } from "vitest";

import { ComponentSpec, Task } from "@/models/componentSpec";

import {
  createUndoStoreWithEvents,
  loadUndoHistory,
  saveIdStack,
  saveUndoHistory,
} from "./undoHistoryStorage";

describe("undoHistoryStorage idStack persistence", () => {
  beforeEach(async () => {
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

describe("createUndoStoreWithEvents", () => {
  it("restores saved undo events that can still be undone", async () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Pipeline" });
    const recordingManager = undoMiddleware(spec);
    spec.addTask(new Task({ $id: "task_1", name: "Train", componentRef: {} }));
    await saveUndoHistory("pipeline-d", ["task_1", "spec_1"], recordingManager);
    recordingManager.dispose();

    const loaded = await loadUndoHistory("pipeline-d");
    const restoredManager = undoMiddleware(
      spec,
      createUndoStoreWithEvents(loaded?.undoEvents ?? []),
    );

    expect(restoredManager.undoLevels).toBe(1);
    restoredManager.undo();
    expect(spec.tasks).toHaveLength(0);
  });
});
