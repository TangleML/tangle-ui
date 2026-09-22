import { describe, expect, it } from "vitest";

import { EditorStore } from "@/routes/v2/shared/store/editorStore";

import { fitViewAfterEdits } from "./fitViewAfterEdits";

const passthrough = { withGroup: <T>(_label: string, fn: () => T) => fn() };

describe("fitViewAfterEdits", () => {
  it("asks the canvas to reframe after an edit", () => {
    const editor = new EditorStore();

    fitViewAfterEdits(passthrough, editor).withGroup("Add task", () => {});

    expect(editor.fitViewRequestCount).toBe(1);
  });

  /** Each tool call is its own step, so the canvas must be able to tell them apart. */
  it("asks again for every further edit", () => {
    const editor = new EditorStore();
    const undo = fitViewAfterEdits(passthrough, editor);

    undo.withGroup("Add task", () => {});
    undo.withGroup("Connect", () => {});

    expect(editor.fitViewRequestCount).toBe(2);
  });

  it("leaves the canvas alone until something is edited", () => {
    expect(new EditorStore().fitViewRequestCount).toBe(0);
  });

  it("still groups the edit and hands back its result", () => {
    const grouped: string[] = [];
    const undo = {
      withGroup: <T>(label: string, fn: () => T): T => {
        grouped.push(label);
        return fn();
      },
    };

    const result = fitViewAfterEdits(undo, new EditorStore()).withGroup(
      "Add task",
      () => "task-1",
    );

    expect(grouped).toEqual(["Add task"]);
    expect(result).toBe("task-1");
  });
});
