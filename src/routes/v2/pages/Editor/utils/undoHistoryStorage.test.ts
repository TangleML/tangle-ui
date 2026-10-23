import "fake-indexeddb/auto";

import { undoMiddleware } from "mobx-keystone";
import { beforeEach, describe, expect, it } from "vitest";

import {
  collectIdStack,
  ComponentSpec,
  Input,
  ReplayIdGenerator,
  serializeComponentSpecToText,
  Task,
  YamlDeserializer,
} from "@/models/componentSpec";
import {
  editorSpecFromRemoteTask,
  remotePipelineTaskFromSpec,
} from "@/services/pipelineStorage/remotePipelineTask";
import { isGraphImplementation } from "@/utils/componentSpec";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

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
    const spec = new ComponentSpec({
      $id: "remote_spec",
      name: "Pipeline",
      description: "Saved description",
      inputs: [new Input({ name: "Greeting", optional: false })],
    });
    const recording = undoMiddleware(spec);
    spec.addTask(
      new Task({ $id: "remote_task", name: "Train", componentRef: {} }),
    );
    const yaml = serializeComponentSpecToText(spec);
    await saveUndoHistory(key, collectIdStack(spec), recording, yaml);
    recording.dispose();

    const { name, description, metadata, inputs, outputs, implementation } =
      componentSpecFromYaml(yaml);
    const serverYaml = componentSpecToYaml({
      name,
      description,
      metadata,
      inputs,
      outputs,
      implementation,
    });
    expect(serverYaml).not.toBe(yaml);
    const stored = await loadUndoHistory(
      key,
      `# Remote document\n${serverYaml}`,
    );
    expect(stored).not.toBeNull();
    if (!stored) throw new Error("Expected saved remote undo history");
    const restored = new YamlDeserializer(
      new ReplayIdGenerator(stored.idStack),
    ).deserialize(componentSpecFromYaml(yaml));
    const manager = undoMiddleware(
      restored,
      createUndoStoreWithEvents(stored.undoEvents),
    );
    manager.undo();
    expect(restored.tasks).toHaveLength(0);
    manager.redo();
    expect(serializeComponentSpecToText(restored)).toBe(yaml);
    manager.dispose();
  });

  it("restores undo after remote saving removes library reference metadata", async () => {
    const spec = new ComponentSpec({ name: "Pipeline" });
    const recording = undoMiddleware(spec);
    spec.addTask(
      new Task({
        name: "Train",
        componentRef: {
          name: "Trainer",
          favorited: true,
          published_by: "author@example.com",
        },
      }),
    );
    const yaml = serializeComponentSpecToText(spec);
    await saveUndoHistory(key, collectIdStack(spec), recording, yaml);
    recording.dispose();

    const serverSpec = editorSpecFromRemoteTask(
      remotePipelineTaskFromSpec(componentSpecFromYaml(yaml)),
    );
    const serverYaml = componentSpecToYaml(serverSpec);
    expect(serverYaml).not.toContain("favorited");
    expect(serverYaml).not.toContain("published_by");
    const stored = await loadUndoHistory(key, serverYaml);
    if (!stored) throw new Error("Expected saved remote undo history");
    const restored = new YamlDeserializer(
      new ReplayIdGenerator(stored.idStack),
    ).deserialize(serverSpec);
    const manager = undoMiddleware(
      restored,
      createUndoStoreWithEvents(stored.undoEvents),
    );
    manager.undo();
    expect(restored.tasks).toHaveLength(0);
    manager.redo();
    expect(restored.tasks.map((task) => task.name)).toEqual(["Train"]);
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

  it("rejects reordered task maps before restoring positional undo patches", async () => {
    const spec = new ComponentSpec({ name: "Pipeline" });
    spec.addTask(new Task({ name: "eval", componentRef: {} }));
    spec.addTask(new Task({ name: "train", componentRef: {} }));
    const manager = undoMiddleware(spec);
    spec.addTask(new Task({ name: "a_new", componentRef: {} }));
    const yaml = serializeComponentSpecToText(spec);
    await saveUndoHistory(key, collectIdStack(spec), manager, yaml);
    manager.dispose();

    const reordered = componentSpecFromYaml(yaml);
    if (!isGraphImplementation(reordered.implementation))
      throw new Error("Expected graph implementation");
    const tasks = reordered.implementation.graph.tasks;
    reordered.implementation.graph.tasks = Object.fromEntries(
      Object.entries(tasks).sort(([a], [b]) => a.localeCompare(b)),
    );

    expect(Object.keys(reordered.implementation.graph.tasks)).not.toEqual(
      Object.keys(tasks),
    );
    expect(await loadUndoHistory(key, yaml)).not.toBeNull();
    expect(
      await loadUndoHistory(key, componentSpecToYaml(reordered)),
    ).toBeNull();
  });
});
