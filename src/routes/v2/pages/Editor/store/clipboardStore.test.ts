import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Task } from "@/models/componentSpec/entities/task";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import type { SystemClipboardInfo } from "@/routes/v2/shared/clipboard/clipboardEnvelope";
import type {
  NodeSnapshot,
  UndoGroupable,
} from "@/routes/v2/shared/nodes/types";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";

import { ClipboardStore } from "./clipboardStore";

/**
 * The real registry transitively imports the router, so the store is exercised
 * against a stand-in that snapshots and clones tasks the same way.
 */
vi.mock("@/routes/v2/pages/Editor/nodes", async () => {
  const { Task: TaskModel } =
    await import("@/models/componentSpec/entities/task");

  const snapshot = (spec: ComponentSpec, entityId: string) => {
    const task = spec.tasks.find((t) => t.$id === entityId);
    if (!task) return null;
    return {
      $type: "task",
      entityId: task.$id,
      name: task.name,
      position: { x: 0, y: 0 },
      data: {},
    };
  };

  return {
    editorRegistry: {
      get: () => ({
        snapshotHandler: { snapshot },
        cloneHandler: {
          snapshot,
          clone: (spec: ComponentSpec, snap: NodeSnapshot) => {
            const task = new TaskModel({
              $id: `${snap.entityId}_clone_${spec.tasks.length}`,
              name: `${snap.name}_copy`,
              componentRef: {},
            });
            spec.addTask(task);
            return task.$id;
          },
        },
      }),
    },
  };
});

const undo: UndoGroupable = { withGroup: (_label, fn) => fn() };

const CENTER = { x: 0, y: 0 };

function stubClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });
}

function specWithTask(): { spec: ComponentSpec; selection: SelectedNode[] } {
  const idGen = new IncrementingIdGenerator();
  const spec = new ComponentSpec({ $id: idGen.next("spec"), name: "Main" });
  const task = new Task({
    $id: idGen.next("task"),
    name: "train_model",
    componentRef: {},
  });
  spec.addTask(task);

  return {
    spec,
    selection: [{ id: task.$id, type: "task", position: { x: 0, y: 0 } }],
  };
}

describe("ClipboardStore", () => {
  let store: ClipboardStore;

  beforeEach(() => {
    store = new ClipboardStore(undo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("copy", () => {
    it("stages the selection and mirrors it to the system clipboard", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      stubClipboard({ writeText });
      const { spec, selection } = specWithTask();

      await store.copy(spec, selection);

      expect(store.hasContent).toBe(true);
      expect(writeText).toHaveBeenCalledOnce();
    });

    it("stages the selection even when the clipboard write is denied", async () => {
      stubClipboard({
        writeText: () => Promise.reject(new Error("NotAllowedError")),
      });
      const { spec, selection } = specWithTask();

      await expect(store.copy(spec, selection)).rejects.toThrow();
      expect(store.hasContent).toBe(true);
    });
  });

  describe("paste", () => {
    it("pastes an envelope from another tab without reading the clipboard", async () => {
      stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
      const source = specWithTask();
      const copiedElsewhere = new ClipboardStore(undo);
      await copiedElsewhere.copy(source.spec, source.selection);

      const readText = vi.fn();
      stubClipboard({ readText });

      const read: SystemClipboardInfo = {
        kind: "envelope",
        envelope: {
          _type: "tangle-pipeline-nodes",
          snapshots: copiedElsewhere.snapshots,
          bindings: copiedElsewhere.bindingSnapshots,
        },
      };

      const target = new ComponentSpec({ $id: "spec_1", name: "Other" });
      await store.paste(target, CENTER, read);

      expect(target.tasks).toHaveLength(1);
      expect(readText).not.toHaveBeenCalled();
    });

    it("rejects when the read fails and nothing is staged", async () => {
      stubClipboard({
        readText: () => Promise.reject(new Error("NotAllowedError")),
      });
      const target = new ComponentSpec({ $id: "spec_1", name: "Other" });

      await expect(store.paste(target, CENTER)).rejects.toThrow();
    });

    it("resolves silently when the clipboard holds no nodes", async () => {
      stubClipboard({ readText: () => Promise.resolve("just some text") });
      const target = new ComponentSpec({ $id: "spec_1", name: "Other" });

      await expect(store.paste(target, CENTER)).resolves.toBeUndefined();
      expect(target.tasks).toHaveLength(0);
    });

    it("falls back to the staged copy when the clipboard holds no nodes", async () => {
      stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
      const { spec, selection } = specWithTask();
      await store.copy(spec, selection);

      await store.paste(spec, CENTER, { kind: "empty" });

      expect(spec.tasks).toHaveLength(2);
    });

    it("cascades repeated pastes so nodes do not stack", async () => {
      stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
      const { spec, selection } = specWithTask();
      await store.copy(spec, selection);

      await store.paste(spec, CENTER, { kind: "empty" });
      await store.paste(spec, CENTER, { kind: "empty" });

      expect(spec.tasks).toHaveLength(3);
      expect(store.pasteOffsetIndex).toBe(2);
    });

    it("leaves the paste offset untouched when nothing is pasted", async () => {
      stubClipboard({
        readText: () => Promise.reject(new Error("NotAllowedError")),
      });
      const target = new ComponentSpec({ $id: "spec_1", name: "Other" });

      await expect(store.paste(target, CENTER)).rejects.toThrow();

      expect(store.pasteOffsetIndex).toBe(0);
    });
  });
});
