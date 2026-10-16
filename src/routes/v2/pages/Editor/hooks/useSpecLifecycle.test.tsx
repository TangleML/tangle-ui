import "fake-indexeddb/auto";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { runInAction } from "mobx";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { AutoSaveIndicator } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/AutoSaveIndicator";
import { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import { PipelineFileStore } from "@/routes/v2/pages/Editor/store/pipelineFileStore";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import {
  saveIdStack,
  saveUndoHistory,
} from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { RootFolderDbStorageDriver } from "@/services/pipelineStorage/drivers/RootFolderDbStorageDriver";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

import { useSpecLifecycle } from "./useSpecLifecycle";

const shared = {
  editor: { resetState: vi.fn(), clearSelection: vi.fn() },
  navigation: {
    activeSpec: null,
    navigationPath: [],
    initNavigation: vi.fn(),
    clearNavigation: vi.fn(),
  },
  windows: { closeWindowsByLinkedEntity: vi.fn() },
};
const undo = new UndoStore();
const notify = vi.fn();
const session = {
  undo,
  pipelineFile: new PipelineFileStore(),
  autoSave: new AutoSaveStore(undo, notify),
};
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => shared,
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => session,
}));
vi.mock("@/utils/componentStore", () => ({}));
vi.mock("@/routes/v2/pages/Editor/utils/undoHistoryStorage", () => ({
  saveIdStack: vi.fn().mockResolvedValue(undefined),
  saveUndoHistory: vi.fn().mockResolvedValue(undefined),
}));

function pipeline(name = "Original", remote = true) {
  const spec = new ComponentSpec({ name });
  const file = new PipelineFile({
    id: name,
    storageKey: name,
    folder: new PipelineFolder({
      id: "folder",
      name: "Folder",
      parentId: null,
      driver: new RootFolderDbStorageDriver(),
    }),
    remote: remote
      ? { backendUrl: "https://example.com", pipelineId: name }
      : undefined,
  });
  return {
    spec,
    file,
    write: vi.spyOn(file, "write").mockResolvedValue(undefined),
  };
}

function Editor({ spec, file }: ReturnType<typeof pipeline>) {
  useSpecLifecycle(spec, file);
  return <AutoSaveIndicator />;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([false, true])(
  "preserves local undo and deduplicates the disposal flush (remote: %s)",
  async (remote) => {
    const current = pipeline("Original", remote);
    const view = render(<Editor {...current} />, { wrapper: StrictMode });
    await session.autoSave.save();
    expect(current.write).not.toHaveBeenCalled();
    const manager = undo.undoManager;
    act(() => {
      undo.withGroup("Rename", () => current.spec.setName("Renamed"));
      runInAction(() => {
        current.file.storageKey = "Renamed";
      });
    });
    view.rerender(<Editor {...current} />);
    expect(undo.undoManager).toBe(manager);
    expect(undo.canUndo).toBe(!remote);
    if (!remote) {
      act(() => undo.undo());
      expect(current.spec.name).toBe("Original");
      act(() => undo.redo());
      expect(current.spec.name).toBe("Renamed");
    }
    fireEvent.click(screen.getByRole("button"));
    view.unmount();
    await vi.runAllTimersAsync();
    expect(current.write).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Renamed"),
    );
    expect(session.pipelineFile.activePipelineFile).toBeNull();
    if (remote) expect(manager).toBeNull();
    expect(saveIdStack).toHaveBeenCalledTimes(remote ? 0 : 2);
    expect(vi.mocked(saveUndoHistory).mock.calls).toEqual(
      remote ? [] : [["Renamed", expect.any(Array), manager]],
    );
  },
);

it("keeps a pending save bound to its file without changing the next document's status", async () => {
  const old = pipeline();
  const next = pipeline("Next");
  let reject!: (error: Error) => void;
  old.write.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<Editor {...old} />, { wrapper: StrictMode });
  act(() => old.spec.setName("Old edited"));
  fireEvent.click(screen.getByRole("button"));
  view.rerender(<Editor {...next} />);
  const error = new Error("Old save failed");
  await act(async () => {
    reject(error);
    await vi.advanceTimersByTimeAsync(600);
  });
  expect(old.write).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining("Old edited"),
  );
  expect(next.write).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Auto-save enabled" }),
  ).toBeEnabled();
  expect(notify).toHaveBeenCalledWith(error);
});

it.each(["Original", "Saved intermediate"])(
  "clears a failed debounced save after restoring %s",
  async (restoredName) => {
    const current = pipeline();
    let finish!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      finish = resolve;
    });
    current.write
      .mockReturnValueOnce(firstWrite)
      .mockImplementationOnce(async () => {
        await firstWrite;
        throw new Error("Storage unavailable");
      });
    render(<Editor {...current} />, { wrapper: StrictMode });
    act(() => current.spec.setName("Saved intermediate"));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(current.write).toHaveBeenCalledOnce();
    act(() => current.spec.setName("Failed edit"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      finish();
      await vi.runAllTimersAsync();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Save failed: Storage unavailable",
    );
    act(() => current.spec.setName(restoredName));
    fireEvent.click(screen.getByRole("button", { name: /Click to retry/ }));
    await act(() => vi.runAllTimersAsync());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Last saved at|Auto-save enabled/ }),
    ).toBeEnabled();
    expect(current.write).toHaveBeenCalledTimes(
      restoredName === "Original" ? 3 : 2,
    );
    if (restoredName === "Original") {
      expect(current.write).toHaveBeenLastCalledWith(
        expect.stringContaining("Original"),
      );
    }
  },
);

it("saves a return to the baseline while another save is pending", async () => {
  const current = pipeline();
  render(<Editor {...current} />, { wrapper: StrictMode });
  await act(async () => {
    current.spec.setName("Intermediate");
    const first = session.autoSave.save();
    current.spec.setName("Original");
    const second = session.autoSave.save();
    await vi.advanceTimersByTimeAsync(600);
    await Promise.all([first, second]);
  });
  expect(current.write).toHaveBeenCalledTimes(2);
  expect(current.write).toHaveBeenLastCalledWith(
    expect.stringContaining("Original"),
  );
});
