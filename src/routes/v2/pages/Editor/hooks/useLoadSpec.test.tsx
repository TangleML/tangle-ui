import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import { StrictMode, Suspense, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import { promoteRemoteDraftQuery } from "@/routes/v2/pages/Editor/utils/promoteRemoteDraftQuery";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
} from "@/services/pipelineStorage/types";

import { EDITOR_SPEC_QUERY_KEY, useLoadSpec } from "./useLoadSpec";

const resolvePipeline = vi.hoisted(() => vi.fn());
const discardRemoteDraft = vi.hoisted(() => vi.fn());
const storage = { resolvePipeline, discardRemoteDraft };
const loadUndoHistory = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const addRecentlyViewed = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useRecentlyViewed", () => ({ addRecentlyViewed }));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock(
  "@/routes/v2/pages/Editor/utils/undoHistoryStorage",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/routes/v2/pages/Editor/utils/undoHistoryStorage")
    >()),
    loadUndoHistory,
    saveUndoHistory: vi.fn().mockResolvedValue(undefined),
  }),
);
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));

const client = new QueryClient();
const remote = {
  source: "remote",
  backendUrl: "https://backend.example.com",
  pipelineId: "pipeline-1",
} as const;
const draft = {
  source: "draft",
  backendUrl: remote.backendUrl,
  draftId: "draft-1",
  name: "Draft",
} as const;
const file = (
  name: string,
  ref?: { backendUrl: string; pipelineId: string },
) => ({
  storageKey: name,
  remote: ref,
  read: async () => `name: ${name}\nimplementation:\n  graph:\n    tasks: {}\n`,
});

function Child({ pipelineRef }: { pipelineRef: EditorPipelineRef }) {
  const { data } = useLoadSpec(pipelineRef);
  return <div>{data.spec.name}</div>;
}
function Parent({ pipelineRef }: { pipelineRef: EditorPipelineRef }) {
  useLoadSpec(pipelineRef);
  return <Child pipelineRef={pipelineRef} />;
}
const EditingChild = observer(function EditingChild({
  pipelineRef,
}: {
  pipelineRef: EditorPipelineRef;
}) {
  const { data } = useLoadSpec(pipelineRef);
  const [undo] = useState(() => new UndoStore());
  const [autoSave] = useState(() => new AutoSaveStore(undo));
  useEffect(() => {
    undo.init(data.spec, data.restoredUndoStore);
    autoSave.init(data.spec, data.file, data.saveState);
    return () => {
      autoSave.dispose();
      undo.dispose();
    };
  }, [autoSave, data, undo]);
  return (
    <>
      <span>{data.spec.name}</span>
      <span>{data.spec.description}</span>
      <span>{autoSave.error}</span>
      <span>{autoSave.isSaving ? "Saving" : "Idle"}</span>
      <button onClick={() => data.spec.setDescription("Unsaved edit")}>
        Edit
      </button>
      <button onClick={() => data.spec.setDescription("Newer edit")}>
        Edit again
      </button>
      <button onClick={() => void autoSave.save().catch(() => {})}>Save</button>
      <button onClick={() => undo.undo()} disabled={!undo.canUndo}>
        Undo
      </button>
      <button onClick={() => undo.redo()} disabled={!undo.canRedo}>
        Redo
      </button>
    </>
  );
});

function view(pipelineRef: EditorPipelineRef, editing = false) {
  return (
    <StrictMode>
      <QueryClientProvider client={client}>
        <Suspense fallback={null}>
          {editing ? (
            <EditingChild pipelineRef={pipelineRef} />
          ) : (
            <Parent pipelineRef={pipelineRef} />
          )}
        </Suspense>
      </QueryClientProvider>
    </StrictMode>
  );
}

afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("useLoadSpec", () => {
  it("keeps new draft undo history when a promoted document starts another editor session", async () => {
    const draft = {
      source: "draft",
      backendUrl: remote.backendUrl,
      draftId: "draft-undo",
      name: "Untouched",
    } as const;
    resolvePipeline.mockResolvedValue({ ...file(draft.name), isDraft: true });
    const opened = render(view(draft));
    await screen.findByText(draft.name);
    const loaded = client.getQueryData<ReturnType<typeof useLoadSpec>["data"]>([
      "editor-v2-spec",
      getEditorPipelineIdentity(draft),
    ])!;
    const firstUndo = new UndoStore();
    firstUndo.init(loaded.spec, loaded.restoredUndoStore);
    await act(async () => loaded.spec.setName("Edited"));
    expect(firstUndo.canUndo).toBe(true);
    firstUndo.dispose();

    promoteRemoteDraftQuery(client, draft, remote);
    opened.rerender(view(remote));
    await screen.findByText("Edited");
    const promoted = client.getQueryData<
      ReturnType<typeof useLoadSpec>["data"]
    >(["editor-v2-spec", getEditorPipelineIdentity(remote)])!;
    expect(promoted).toBe(loaded);
    const nextUndo = new UndoStore();
    nextUndo.init(promoted.spec, promoted.restoredUndoStore);
    try {
      expect(nextUndo.canUndo).toBe(true);
      await act(async () => nextUndo.undo());
      expect(promoted.spec.name).toBe(draft.name);
    } finally {
      nextUndo.dispose();
    }
  });

  it("keeps an open StrictMode draft in memory and discards it on close", async () => {
    const draft = {
      source: "draft",
      backendUrl: remote.backendUrl,
      draftId: "draft-1",
      name: "Untouched",
    } as const;
    resolvePipeline.mockResolvedValue({ ...file(draft.name), isDraft: true });
    const opened = render(view(draft));
    await screen.findByText(draft.name);
    expect(loadUndoHistory).not.toHaveBeenCalled();
    expect(discardRemoteDraft).not.toHaveBeenCalled();
    expect(addRecentlyViewed).not.toHaveBeenCalled();
    await act(async () => opened.unmount());
    expect(discardRemoteDraft).toHaveBeenCalledWith(draft);
  });
  it("keeps nested StrictMode observers stable, then reloads a closed remote document", async () => {
    resolvePipeline.mockResolvedValue(file("Before", remote));
    const first = render(view(remote));
    await screen.findByText("Before");
    expect(resolvePipeline).toHaveBeenCalledExactlyOnceWith(remote);
    expect(addRecentlyViewed).toHaveBeenLastCalledWith({
      type: "remote-pipeline",
      id: remote.pipelineId,
      name: "Before",
    });
    expect(loadUndoHistory).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(["remote-pipeline", remote.backendUrl, remote.pipelineId]),
      expect.stringContaining("Before"),
    );
    await act(async () => first.unmount());
    resolvePipeline.mockResolvedValue(file("After", remote));
    render(view(remote));
    await screen.findByText("After");
    expect(resolvePipeline).toHaveBeenCalledTimes(2);
    expect(addRecentlyViewed).toHaveBeenLastCalledWith({
      type: "remote-pipeline",
      id: remote.pipelineId,
      name: "After",
    });
  });

  it("records a draft only after it becomes a remote pipeline without navigation", async () => {
    const draft = {
      source: "draft",
      backendUrl: remote.backendUrl,
      draftId: "draft-1",
      name: "New pipeline",
    } as const;
    const current = observable({ ...file(draft.name), isDraft: true });
    resolvePipeline.mockResolvedValue(current);
    render(view(draft));
    await screen.findByText(draft.name);
    expect(addRecentlyViewed).not.toHaveBeenCalled();

    act(() => {
      runInAction(() => {
        current.remote = remote;
        current.isDraft = false;
      });
    });

    expect(addRecentlyViewed).toHaveBeenLastCalledWith({
      type: "remote-pipeline",
      id: remote.pipelineId,
      name: draft.name,
    });
  });

  it.each([remote, draft])(
    "retains failed $source edits after unmount and retries them from the saved baseline",
    async (pipelineRef) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const write = vi.fn().mockRejectedValue(new Error("Save unavailable"));
      resolvePipeline.mockResolvedValue({ ...file("Original"), write });
      const first = render(view(pipelineRef, true));
      await screen.findByText("Original");
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Save"));
      await screen.findByText("Save unavailable");
      await act(async () => first.unmount());
      await waitFor(() => expect(write).toHaveBeenCalledTimes(2));

      const reopened = render(view(pipelineRef, true));
      await screen.findByText("Unsaved edit");
      await screen.findByText("Save unavailable");
      expect(resolvePipeline).toHaveBeenCalledTimes(1);
      expect(discardRemoteDraft).not.toHaveBeenCalled();
      await screen.findByText("Idle");
      const attemptsBeforeRetry = write.mock.calls.length;
      write.mockResolvedValue(undefined);
      fireEvent.click(screen.getByText("Save"));
      await waitFor(() =>
        expect(write).toHaveBeenCalledTimes(attemptsBeforeRetry + 1),
      );
      expect(write).toHaveBeenLastCalledWith(
        expect.stringContaining("Unsaved edit"),
      );
      await act(async () => reopened.unmount());
      await waitFor(() =>
        expect(client.getQueryCache().getAll()).toHaveLength(0),
      );

      resolvePipeline.mockResolvedValue(file("Saved on server"));
      render(view(pipelineRef));
      await screen.findByText("Saved on server");
      expect(resolvePipeline).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps undo and redo when reopening a failed edit without stored history", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi.fn().mockRejectedValue(new Error("Save unavailable"));
    resolvePipeline.mockResolvedValue({ ...file("Original", remote), write });
    const first = render(view(remote, true));
    await screen.findByText("Original");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    await screen.findByText("Save unavailable");
    await act(async () => first.unmount());

    render(view(remote, true));
    await screen.findByText("Unsaved edit");
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(screen.queryByText("Unsaved edit")).not.toBeInTheDocument();
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(redo).toBeEnabled();
    fireEvent.click(redo);
    expect(screen.getByText("Unsaved edit")).toBeInTheDocument();
    expect(resolvePipeline).toHaveBeenCalledTimes(1);
  });

  it.each([remote, draft])(
    "keeps an in-flight $source edit through reopen without duplicating its write",
    async (pipelineRef) => {
      let finish!: () => void;
      const write = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      resolvePipeline.mockResolvedValue({ ...file("Original"), write });
      const first = render(view(pipelineRef, true));
      await screen.findByText("Original");
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Save"));
      await act(async () => first.unmount());
      const reopened = render(view(pipelineRef, true));
      await screen.findByText("Unsaved edit");
      fireEvent.click(screen.getByText("Save"));
      expect(write).toHaveBeenCalledTimes(1);
      expect(resolvePipeline).toHaveBeenCalledTimes(1);
      expect(discardRemoteDraft).not.toHaveBeenCalled();
      await act(async () => reopened.unmount());
      finish();
      await waitFor(() =>
        expect(client.getQueryCache().getAll()).toHaveLength(0),
      );
    },
  );

  it("releases both draft and remote aliases when a promoted pending save closes", async () => {
    let finish!: () => void;
    const write = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    resolvePipeline.mockResolvedValue({
      ...file(draft.name),
      isDraft: true,
      write,
    });
    const opened = render(view(draft, true));
    await screen.findByText(draft.name);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));

    promoteRemoteDraftQuery(client, draft, remote);
    await act(async () => opened.rerender(view(remote, true)));
    expect(client.getQueryCache().getAll()).toHaveLength(2);
    await act(async () => opened.unmount());
    expect(client.getQueryCache().getAll()).toHaveLength(2);
    expect(write).toHaveBeenCalledOnce();
    expect(discardRemoteDraft).not.toHaveBeenCalled();

    finish();
    await waitFor(() =>
      expect(client.getQueryCache().getAll()).toHaveLength(0),
    );
    expect(discardRemoteDraft).toHaveBeenCalledExactlyOnceWith(draft);
  });

  it("does not evict a newer failed edit when an older write succeeds", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let finish!: () => void;
    const earlier = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const write = vi
      .fn()
      .mockReturnValueOnce(earlier)
      .mockImplementation(async () => {
        await earlier;
        throw new Error("Latest save failed");
      });
    resolvePipeline.mockResolvedValue({ ...file("Original"), write });
    const first = render(view(remote, true));
    await screen.findByText("Original");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    fireEvent.click(screen.getByText("Edit again"));
    fireEvent.click(screen.getByText("Save"));
    await act(async () => first.unmount());
    await act(async () => finish());
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    const retained = client
      .getQueryCache()
      .findAll({ queryKey: [EDITOR_SPEC_QUERY_KEY] });
    expect(retained).toHaveLength(1);
    render(view(remote, true));
    await screen.findByText("Newer edit");
    await screen.findByText("Latest save failed");
    expect(resolvePipeline).toHaveBeenCalledTimes(1);
  });

  it("loads the same ID separately for each backend", async () => {
    resolvePipeline.mockResolvedValue(file("First backend", remote));
    const { rerender } = render(view(remote));
    await screen.findByText("First backend");
    const other = { ...remote, backendUrl: "https://other.example.com" };
    resolvePipeline.mockResolvedValue(file("Second backend", other));
    rerender(view(other));
    await screen.findByText("Second backend");
    expect(resolvePipeline).toHaveBeenLastCalledWith(other);
  });

  it("restores local history using the resolved file name", async () => {
    resolvePipeline.mockResolvedValue(file("Current name"));
    const ref = { name: "Old name", fileId: "local-id" };
    render(view(ref));
    await screen.findByText("Current name");
    expect(resolvePipeline).toHaveBeenCalledExactlyOnceWith(ref);
    expect(loadUndoHistory).toHaveBeenCalledExactlyOnceWith(
      "Current name",
      undefined,
    );
    expect(addRecentlyViewed).not.toHaveBeenCalled();
  });
});
