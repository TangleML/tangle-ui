import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

import { useSpecLifecycle } from "./useSpecLifecycle";

vi.mock("@/services/pipelineStorage/createDriver", () => ({
  createDriver: vi.fn(),
}));
vi.mock("@/services/pipelineStorage/db", () => ({ pipelineStorageDb: {} }));

const { session, shared } = vi.hoisted(() => ({
  session: {
    undo: { init: vi.fn(), dispose: vi.fn() },
    autoSave: { init: vi.fn(), dispose: vi.fn() },
    pipelineFile: { init: vi.fn(), dispose: vi.fn() },
  },
  shared: {
    editor: { resetState: vi.fn(), clearSelection: vi.fn() },
    navigation: {
      initNavigation: vi.fn(),
      clearNavigation: vi.fn(),
      correctInvalidNavigation: vi.fn(),
      navigationPath: [],
      activeSpec: null,
    },
    windows: { closeWindowsByLinkedEntity: vi.fn() },
  },
}));

vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => session,
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => shared,
}));

describe("useSpecLifecycle read-only pipeline", () => {
  it("blocks root and nested mutations and never initializes autosave", () => {
    vi.clearAllMocks();
    const spec = new ComponentSpec({ $id: "root", name: "Published" });
    const input = new Input({ $id: "input", name: "dataset" });
    spec.addInput(input);
    const file = new PipelineFile({
      id: "remote",
      storageKey: "Published",
      folder: new PipelineFolder({
        id: "remote-folder",
        name: "Remote",
        parentId: null,
        driver: {
          type: "test",
          allowsMoveIn: false,
          allowsMoveOut: false,
          list: async () => [],
          read: async () => "",
          write: async () => {},
          rename: async () => {},
          delete: async () => {},
          hasKey: async () => true,
        },
      }),
    });
    vi.spyOn(file, "canEdit", "get").mockReturnValue(false);
    const { unmount } = renderHook(() => useSpecLifecycle(spec, file));
    expect(session.pipelineFile.init).toHaveBeenCalledWith(file);
    expect(session.autoSave.init).not.toHaveBeenCalled();
    expect(session.undo.init).not.toHaveBeenCalled();
    expect(() => spec.setName("Changed")).toThrow(/readonly/);
    expect(() => input.setDescription("Changed")).toThrow(/readonly/);
    expect(spec.name).toBe("Published");
    expect(input.description).toBeUndefined();
    unmount();
    expect(() => spec.setName("Released")).not.toThrow();
  });
});
