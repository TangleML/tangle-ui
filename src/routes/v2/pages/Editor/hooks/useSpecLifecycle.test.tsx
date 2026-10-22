import { act, fireEvent, render, screen } from "@testing-library/react";
import { runInAction } from "mobx";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { serializeComponentSpec } from "@/models/componentSpec";
import { ComponentSpec } from "@/models/componentSpec";
import { AutoSaveIndicator } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/AutoSaveIndicator";
import { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import { DocumentSaveState } from "@/routes/v2/pages/Editor/store/documentSaveState";
import { PipelineFileStore } from "@/routes/v2/pages/Editor/store/pipelineFileStore";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { withRemotePipelineDeletion } from "@/services/pipelineStorage/remotePipelineDeletion";
import { componentSpecToText } from "@/utils/yaml";

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
  autoSave: new AutoSaveStore(notify),
};
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => shared,
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => session,
}));
vi.mock("@/utils/componentStore", () => ({}));
const documents: DocumentSaveState[] = [];
function pipeline(name = "Original") {
  const spec = new ComponentSpec({ name });
  const file = new PipelineFile({
    ref: {
      source: "remote",
      backendUrl: "https://example.com",
      pipelineId: name,
    },
    document: {
      id: name,
      user_id: "owner",
      pipeline_name: name,
      pipeline_run_annotations: {},
      file_path: `pipelines/${name}.yaml`,
      root_pipeline_task: {
        componentRef: {
          spec: { name, implementation: { graph: { tasks: {} } } },
        },
      },
    },
  });
  const write = vi.spyOn(file, "write").mockResolvedValue(undefined);
  const saveState = new DocumentSaveState(spec, file);
  documents.push(saveState);
  return { spec, file, write, saveState };
}

function Editor({ spec, file, saveState }: ReturnType<typeof pipeline>) {
  useSpecLifecycle(spec, file, saveState);
  return <AutoSaveIndicator />;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  documents.splice(0).forEach((document) => document.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("preserves session undo/redo and deduplicates the disposal flush", async () => {
  const current = pipeline("Original");
  const view = render(<Editor {...current} />, { wrapper: StrictMode });
  await session.autoSave.save();
  expect(current.write).not.toHaveBeenCalled();
  const manager = undo.undoManager;
  act(() => {
    undo.withGroup("Rename", () => current.spec.setName("Renamed"));
  });
  view.rerender(<Editor {...current} />);
  expect(undo.undoManager).toBe(manager);
  expect(undo.canUndo).toBe(true);
  act(() => undo.undo());
  expect(current.spec.name).toBe("Original");
  act(() => undo.redo());
  expect(current.spec.name).toBe("Renamed");
  fireEvent.click(screen.getByRole("button"));
  view.unmount();
  await vi.runAllTimersAsync();
  expect(current.write).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: "Renamed" }),
  );
  expect(session.pipelineFile.activePipelineFile).toBeNull();
  expect(manager).not.toBeNull();
  expect(undo.undoManager).toBeNull();
});

it("creates an untouched draft only on explicit Save, not mount or close", async () => {
  const current = pipeline("Untouched draft");
  runInAction(() => {
    current.file.remote = undefined;
  });
  current.write.mockImplementation(async () => {
    runInAction(() => {
      current.file.remote = {
        backendUrl: "https://example.com",
        pipelineId: "saved-draft",
      };
    });
  });

  const firstMount = render(<Editor {...current} />, { wrapper: StrictMode });
  await act(() => vi.runAllTimersAsync());
  expect(current.write).not.toHaveBeenCalled();
  firstMount.unmount();
  await act(() => vi.runAllTimersAsync());
  expect(current.write).not.toHaveBeenCalled();

  const reopened = render(<Editor {...current} />, { wrapper: StrictMode });
  fireEvent.click(
    screen.getByRole("button", { name: "Draft — click to save" }),
  );
  await act(() => vi.runAllTimersAsync());
  expect(current.write).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: "Untouched draft" }),
  );
  expect(current.file.isDraft).toBe(false);
  reopened.unmount();
  await act(() => vi.runAllTimersAsync());
  expect(current.write).toHaveBeenCalledOnce();
});

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
    expect.objectContaining({ name: "Old edited" }),
  );
  expect(next.write).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Auto-save enabled" }),
  ).toBeEnabled();
  expect(notify).toHaveBeenCalledWith(error);
});

it.each(["Original", "Saved intermediate"])(
  "writes restored %s after an uncertain save failure",
  async (restoredName) => {
    const current = pipeline();
    let finish!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let serverYaml = "";
    current.write
      .mockImplementation(async (yaml) => {
        serverYaml = componentSpecToText(yaml);
      })
      .mockImplementationOnce(async (yaml) => {
        await firstWrite;
        serverYaml = componentSpecToText(yaml);
      })
      .mockImplementationOnce(async (yaml) => {
        await firstWrite;
        serverYaml = componentSpecToText(yaml);
        throw new Error("Storage unavailable");
      });
    render(<Editor {...current} />, { wrapper: StrictMode });
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(screen.getByRole("button")).not.toContainElement(status);
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
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toBeEmptyDOMElement();
    expect(
      screen.getByRole("button", { name: /Last saved at|Auto-save enabled/ }),
    ).toBeEnabled();
    expect(current.write).toHaveBeenCalledTimes(3);
    expect(current.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: restoredName }),
    );
    expect(serverYaml).toContain(`name: ${restoredName}`);
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
    expect.objectContaining({ name: "Original" }),
  );
});

it("autosaves remote undo and redo without carrying history to another document", async () => {
  const current = pipeline();
  const view = render(<Editor {...current} />, { wrapper: StrictMode });
  act(() => current.spec.setDescription("Edited"));
  await act(() => vi.runAllTimersAsync());
  expect(current.write).toHaveBeenLastCalledWith(
    expect.objectContaining({ description: "Edited" }),
  );

  act(() => undo.undo());
  await act(() => vi.runAllTimersAsync());
  expect(current.spec.description).toBeUndefined();
  expect(current.write).toHaveBeenLastCalledWith(
    expect.not.objectContaining({ description: "Edited" }),
  );

  act(() => undo.redo());
  await act(() => vi.runAllTimersAsync());
  expect(current.spec.description).toBe("Edited");
  expect(current.write).toHaveBeenLastCalledWith(
    expect.objectContaining({ description: "Edited" }),
  );
  expect(current.write).toHaveBeenCalledTimes(3);

  view.rerender(<Editor {...pipeline("Next")} />);
  expect(undo.canUndo).toBe(false);
  expect(undo.canRedo).toBe(false);
});

it("clears the save indicator and unload guard when the write finishes", async () => {
  const current = pipeline();
  const addListener = vi.spyOn(window, "addEventListener");
  const removeListener = vi.spyOn(window, "removeEventListener");
  const view = render(<Editor {...current} />);
  act(() => current.spec.setName("Saved"));
  const unloadGuard = addListener.mock.calls.find(
    ([type]) => type === "beforeunload",
  )?.[1];
  expect(unloadGuard).toBeTypeOf("function");
  fireEvent.click(screen.getByRole("button"));
  await act(async () => {
    await Promise.resolve();
  });
  expect(session.autoSave.isSaving).toBe(false);
  expect(session.autoSave.hasUnsavedChanges).toBe(false);
  expect(removeListener).toHaveBeenCalledWith("beforeunload", unloadGuard);
  await act(() => vi.runAllTimersAsync());
  view.unmount();
});

it("announces a retry that fails with the same message", async () => {
  const current = pipeline();
  current.write.mockRejectedValue(new Error("Unavailable"));
  const view = render(<Editor {...current} />);
  act(() => current.spec.setName("Unsaved"));
  fireEvent.click(screen.getByRole("button"));
  await act(() => vi.runAllTimersAsync());
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Save failed: Unavailable");
  fireEvent.click(screen.getByRole("button", { name: /Click to retry/ }));
  expect(status).toHaveTextContent("Saving...");
  await act(() => vi.runAllTimersAsync());
  expect(status).toHaveTextContent("Save failed: Unavailable");
  current.write.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: /Click to retry/ }));
  await act(() => vi.runAllTimersAsync());
  view.unmount();
});

it.each([false, true])(
  "keeps deleted source edits until an unchanged copy succeeds (edited during copy: %s)",
  async (editedDuringCopy) => {
    const current = pipeline(`deleted-copy-${editedDuringCopy}`);
    const view = render(<Editor {...current} />);
    const removedListener = vi.spyOn(window, "removeEventListener");
    act(() => current.spec.setDescription("Recover this content"));
    const snapshot = JSON.stringify(serializeComponentSpec(current.spec));
    await withRemotePipelineDeletion(
      { source: "remote", ...current.file.remote! },
      `pipelines/${current.file.id}.yaml`,
      async () => {},
    );
    if (editedDuringCopy)
      act(() => current.spec.setDescription("A later edit"));
    act(() => session.autoSave.releaseRecoveredCopy(current.file, snapshot));
    expect(session.autoSave.hasUnsavedChanges).toBe(editedDuringCopy);
    if (!editedDuringCopy)
      expect(removedListener).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function),
      );
    view.unmount();
    await act(() => vi.runAllTimersAsync());
    expect(current.write).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  },
);
