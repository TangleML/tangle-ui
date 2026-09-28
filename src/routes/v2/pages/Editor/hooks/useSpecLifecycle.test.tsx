import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { collectIdStack, ComponentSpec } from "@/models/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import { saveIdStack } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

import { useSpecLifecycle } from "./useSpecLifecycle";

vi.mock("@/services/pipelineStorage/createDriver", () => ({
  createDriver: vi.fn(),
}));
vi.mock("@/services/pipelineStorage/db", () => ({ pipelineStorageDb: {} }));
vi.mock("@/routes/v2/pages/Editor/utils/undoHistoryStorage", () => ({
  saveIdStack: vi.fn().mockResolvedValue(undefined),
}));

function createFile() {
  return new PipelineFile({
    id: "pipeline",
    storageKey: "Stored name",
    folder: new PipelineFolder({
      id: "folder",
      name: "Pipelines",
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
}

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
  it.each(["local", "remote"] as const)(
    "persists initial entity IDs only for local storage (%s)",
    (storageKind) => {
      vi.clearAllMocks();
      const spec = new ComponentSpec({ $id: "root", name: "Display name" });
      const file = createFile();
      vi.spyOn(file, "storageKind", "get").mockReturnValue(storageKind);

      const { unmount } = renderHook(() => useSpecLifecycle(spec, file));

      expect(session.autoSave.init).toHaveBeenCalledWith(spec);
      if (storageKind === "local") {
        expect(saveIdStack).toHaveBeenCalledWith(
          file.referenceId,
          collectIdStack(spec),
        );
      } else {
        expect(saveIdStack).not.toHaveBeenCalled();
      }
      unmount();
    },
  );

  it("blocks root and nested mutations and never initializes autosave", () => {
    vi.clearAllMocks();
    const spec = new ComponentSpec({ $id: "root", name: "Published" });
    const input = new Input({ $id: "input", name: "dataset" });
    spec.addInput(input);
    const file = createFile();
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
