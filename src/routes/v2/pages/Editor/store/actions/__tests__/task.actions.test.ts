import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseRecent,
  useRecentlyUsed,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { type ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { addTask } from "@/routes/v2/pages/Editor/store/actions/task.actions";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

const component: ComponentReference = {
  digest: "print-message-digest",
  spec: {
    name: "Print message",
    implementation: {
      container: { image: "alpine", command: ["echo", "hello"] },
    },
  },
};

describe("addTask component history", () => {
  let spec: ComponentSpec;
  let undo: UndoStore;

  beforeEach(() => {
    localStorage.clear();
    spec = new ComponentSpec({ $id: "pipeline", name: "Pipeline" });
    undo = new UndoStore();
    undo.init(spec);
  });

  afterEach(() => {
    cleanup();
    undo.dispose();
    vi.restoreAllMocks();
  });

  it("updates the dashboard history when a component is added and preserves it through undo/redo", () => {
    const { result } = renderHook(() => ({
      ...useRecentlyUsed(),
      ...useRecentlyViewed(),
    }));

    act(() => {
      addTask(undo, spec, component, { x: 0, y: 0 });
    });

    expect(spec.tasks).toHaveLength(1);
    const expected = [
      {
        type: "component",
        id: component.digest,
        name: "Print message",
        timestamp: expect.any(Number),
      },
    ];
    expect(result.current.recentlyUsed).toEqual(expected);
    expect(result.current.recentlyViewed).toEqual([]);
    const stored = localStorage.getItem("Home/recently_used")!;
    expect(parseRecent(stored)).toEqual(expected);

    act(() => undo.undo());
    expect(spec.tasks).toHaveLength(0);
    act(() => undo.redo());
    expect(spec.tasks).toHaveLength(1);
    expect(localStorage.getItem("Home/recently_used")).toBe(stored);
  });

  it("uses the reference name when the component spec has no name", () => {
    const { result } = renderHook(useRecentlyUsed);
    act(() => {
      addTask(
        undo,
        spec,
        { digest: "imported-digest", name: "Imported step" },
        { x: 0, y: 0 },
      );
    });
    expect(result.current.recentlyUsed[0]?.name).toBe("Imported step");
  });

  it.each([undefined, ""])(
    "omits components without a usable digest (%s)",
    (digest) => {
      const { result } = renderHook(useRecentlyUsed);
      act(() => {
        addTask(undo, spec, { ...component, digest }, { x: 0, y: 0 });
      });
      expect(spec.tasks).toHaveLength(1);
      expect(result.current.recentlyUsed).toEqual([]);
    },
  );

  it("does not record a failed addition", () => {
    vi.spyOn(spec, "addTask").mockImplementation(() => {
      throw new Error("Unable to add task");
    });
    expect(() => addTask(undo, spec, component, { x: 0, y: 0 })).toThrow(
      "Unable to add task",
    );
    expect(localStorage.getItem("Home/recently_used")).toBeNull();
  });
});
