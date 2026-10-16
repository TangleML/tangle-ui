import "fake-indexeddb/auto";

import { undoMiddleware } from "mobx-keystone";
import { beforeEach, describe, expect, it } from "vitest";

import {
  collectIdStack,
  ComponentSpec,
  ReplayIdGenerator,
  serializeComponentSpecToText,
  Task,
  YamlDeserializer,
} from "@/models/componentSpec";
import { componentSpecFromYaml } from "@/utils/yaml";

import {
  createUndoStoreWithEvents,
  getUndoHistoryKey,
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

describe("remote browser history", () => {
  const remote = {
    backendUrl: "https://example.com",
    pipelineId: "pipeline-1",
  };
  const key = getUndoHistoryKey({ storageKey: "Pipeline", remote });

  it("uses the backend and pipeline ID across renames without sharing local or other remote history", () => {
    expect(getUndoHistoryKey({ storageKey: "Renamed", remote })).toBe(key);
    expect(getUndoHistoryKey({ storageKey: "Pipeline" })).not.toBe(key);
    expect(
      getUndoHistoryKey({
        storageKey: "Pipeline",
        remote: { ...remote, pipelineId: "pipeline-2" },
      }),
    ).not.toBe(key);
    expect(
      getUndoHistoryKey({
        storageKey: "Pipeline",
        remote: { ...remote, backendUrl: "https://other.example.com" },
      }),
    ).not.toBe(key);
  });

  it("restores working undo/redo after deserializing a saved remote document", async () => {
    const spec = new ComponentSpec({ $id: "remote_spec", name: "Pipeline" });
    const recording = undoMiddleware(spec);
    spec.addTask(
      new Task({ $id: "remote_task", name: "Train", componentRef: {} }),
    );
    const yaml = serializeComponentSpecToText(spec);
    await saveUndoHistory(key, collectIdStack(spec), recording, yaml);
    recording.dispose();

    // Formatting changes in the server YAML do not invalidate the history.
    const stored = await loadUndoHistory(key, `# Remote document\n${yaml}`);
    expect(stored).not.toBeNull();
    const restored = new YamlDeserializer(
      new ReplayIdGenerator(stored!.idStack),
    ).deserialize(componentSpecFromYaml(yaml));
    const manager = undoMiddleware(
      restored,
      createUndoStoreWithEvents(stored!.undoEvents),
    );
    manager.undo();
    expect(restored.tasks).toHaveLength(0);
    manager.redo();
    expect(serializeComponentSpecToText(restored)).toBe(yaml);
    manager.dispose();
  });

  it("discards history when the remote pipeline was changed elsewhere", async () => {
    const spec = new ComponentSpec({ name: "Pipeline" });
    const manager = undoMiddleware(spec);
    spec.setDescription("Browser edit");
    const yaml = serializeComponentSpecToText(spec);
    await saveUndoHistory(key, collectIdStack(spec), manager, yaml);
    expect(
      await loadUndoHistory(
        key,
        yaml.replace("Browser edit", "Other computer edit"),
      ),
    ).toBeNull();
    expect(await loadUndoHistory(key, yaml)).not.toBeNull();
    manager.dispose();
  });
});
