import { QueryErrorResetBoundary } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { isRootStore } from "mobx-keystone";
import { observer } from "mobx-react-lite";
import { StrictMode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPipelineDocument,
  type SavedPipelineDocument,
} from "@/services/pipelineSpecService";
import {
  type LoadedSpec,
  PipelineStorageService,
} from "@/services/pipelineStorage/PipelineStorageService";
import { withRemotePipelineDeletion } from "@/services/pipelineStorage/remotePipelineDeletion";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";
import {
  getRemotePipelineWriter,
  writeRemotePipelineDocument,
} from "@/services/remotePipelineEditorService";

import { useLoadSpec } from "./useLoadSpec";
import { useRetainDocument } from "./useRetainDocument";

let storage: PipelineStorageService;
const addRecentlyViewed = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useRecentlyViewed", () => ({ addRecentlyViewed }));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));
vi.mock("@/services/pipelineSpecService", async (original) => ({
  ...(await original<typeof import("@/services/pipelineSpecService")>()),
  getPipelineDocument: vi.fn(),
}));
vi.mock("@/services/remotePipelineEditorService", async (original) => ({
  ...(await original<
    typeof import("@/services/remotePipelineEditorService")
  >()),
  getRemotePipelineWriter: vi.fn(),
  writeRemotePipelineDocument: vi.fn(),
}));

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
let server: SavedPipelineDocument;
const loaded = new Set<LoadedSpec>();
const Child = observer(
  ({ pipelineRef }: { pipelineRef: EditorPipelineRef }) => {
    const { data } = useLoadSpec(pipelineRef);
    loaded.add(data);
    return (
      <>
        <span>{data.spec.name}</span>
        <span>{data.spec.description}</span>
        <span>{data.saveState.error}</span>
        <span>{data.saveState.isSaving ? "Saving" : "Idle"}</span>
        <button onClick={() => data.spec.setDescription("Unsaved edit")}>
          Edit
        </button>
        <button onClick={() => data.spec.setDescription("Newer edit")}>
          Edit again
        </button>
        <button onClick={() => void data.saveState.save().catch(() => {})}>
          Save
        </button>
        <button
          onClick={() => data.undoManager.undo()}
          disabled={!data.undoManager.canUndo}
        >
          Undo
        </button>
      </>
    );
  },
);
function Parent({ pipelineRef }: { pipelineRef: EditorPipelineRef }) {
  useLoadSpec(pipelineRef);
  return <Child pipelineRef={pipelineRef} />;
}
function Owner({ pipelineRef }: { pipelineRef: EditorPipelineRef }) {
  useRetainDocument(pipelineRef);
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <>
              <span>{String(error)}</span>
              <button onClick={resetErrorBoundary}>Retry load</button>
            </>
          )}
        >
          <Suspense fallback={<span>Loading</span>}>
            <Parent pipelineRef={pipelineRef} />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
function view(pipelineRef: EditorPipelineRef) {
  return (
    <StrictMode>
      <Owner pipelineRef={pipelineRef} />
    </StrictMode>
  );
}
async function mount(pipelineRef: EditorPipelineRef) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(view(pipelineRef));
  });
  return result;
}

beforeEach(() => {
  storage = new PipelineStorageService();
  localStorage.clear();
  sessionStorage.clear();
  vi.resetAllMocks();
  server = {
    id: remote.pipelineId,
    user_id: "owner",
    file_path: "pipelines/test.yaml",
    pipeline_name: "Original",
    pipeline_run_annotations: {},
    root_pipeline_task: {
      componentRef: {
        spec: { name: "Original", implementation: { graph: { tasks: {} } } },
      },
    },
  };
  vi.mocked(getPipelineDocument).mockImplementation(async (id) => ({
    ...structuredClone(server),
    id,
  }));
  vi.mocked(getRemotePipelineWriter).mockResolvedValue("owner");
  vi.mocked(writeRemotePipelineDocument).mockImplementation(
    async (_backend, filePath, input) => {
      server = { ...server, file_path: filePath, ...input };
      return structuredClone(server);
    },
  );
});
afterEach(async () => {
  await act(async () => cleanup());
  for (const document of loaded) {
    document.saveState.dispose();
    document.undoManager.dispose();
  }
  loaded.clear();
  vi.restoreAllMocks();
});

describe("document lifetime through useLoadSpec", () => {
  it("releases a load abandoned before the editor mounts", async () => {
    const response = Promise.withResolvers<SavedPipelineDocument>();
    vi.mocked(getPipelineDocument).mockReturnValueOnce(response.promise);
    const first = await mount(remote);
    await screen.findByText("Loading");
    const loading = storage.loadDocument(remote);
    await act(async () => first.unmount());

    let abandoned!: LoadedSpec;
    await act(async () => {
      response.resolve(structuredClone(server));
      abandoned = await loading;
    });
    expect(isRootStore(abandoned.spec)).toBe(false);
    expect(storage.getFile(remote)).toBeUndefined();
    expect(writeRemotePipelineDocument).not.toHaveBeenCalled();

    server.root_pipeline_task.componentRef.spec.name = "Updated after leaving";
    await mount(remote);
    await screen.findByText("Updated after leaving");
    expect(getPipelineDocument).toHaveBeenCalledTimes(2);
  });

  it("keeps a loading document until every mounted owner leaves", async () => {
    const response = Promise.withResolvers<SavedPipelineDocument>();
    vi.mocked(getPipelineDocument).mockReturnValueOnce(response.promise);
    const first = await mount(remote);
    const second = await mount(remote);
    const loading = storage.loadDocument(remote);
    await act(async () => first.unmount());
    await act(async () => {
      response.resolve(structuredClone(server));
      await loading;
    });

    await screen.findByText("Original");
    const document = await loading;
    expect(isRootStore(document.spec)).toBe(true);
    expect(getPipelineDocument).toHaveBeenCalledOnce();
    await act(async () => second.unmount());
    expect(isRootStore(document.spec)).toBe(false);
    expect(storage.getFile(remote)).toBeUndefined();
  });

  it("shares nested StrictMode observers, then reloads a clean document after close", async () => {
    const first = await mount(remote);
    await screen.findByText("Original");
    expect(getPipelineDocument).toHaveBeenCalledExactlyOnceWith(
      remote.pipelineId,
      remote.backendUrl,
    );
    expect(loaded.size).toBe(1);
    const original = await storage.loadDocument(remote);
    await act(async () => first.unmount());
    expect(isRootStore(original.spec)).toBe(false);
    server.root_pipeline_task.componentRef.spec.name = "Updated on server";
    await mount(remote);
    await screen.findByText("Updated on server");
    expect(getPipelineDocument).toHaveBeenCalledTimes(2);
  });

  it("abandons an untouched draft on close without uploading it", async () => {
    const first = await mount(draft);
    await screen.findByText("Draft");
    expect(getPipelineDocument).not.toHaveBeenCalled();
    await act(async () => first.unmount());
    expect(writeRemotePipelineDocument).not.toHaveBeenCalled();
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });

  it("retains failed edits and undo history across close, then releases them after a successful retry", async () => {
    vi.mocked(writeRemotePipelineDocument).mockRejectedValue(
      new Error("Save unavailable"),
    );
    const first = await mount(remote);
    await screen.findByText("Original");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    await screen.findByText("Save unavailable");
    const document = await storage.loadDocument(remote);
    await act(async () => first.unmount());
    expect(isRootStore(document.spec)).toBe(true);
    const second = await mount(remote);
    await screen.findByText("Unsaved edit");
    expect(screen.getByText("Undo")).toBeEnabled();
    expect(await storage.loadDocument(remote)).toBe(document);
    expect(getPipelineDocument).toHaveBeenCalledOnce();
    vi.mocked(writeRemotePipelineDocument).mockResolvedValue(server);
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(document.saveState.hasUnsavedChanges).toBe(false),
    );
    await act(async () => second.unmount());
    expect(storage.getFile(remote)).toBeUndefined();
    expect(isRootStore(document.spec)).toBe(false);
  });

  it("keeps a pending save and its model when reopened", async () => {
    const pending = Promise.withResolvers<SavedPipelineDocument>();
    vi.mocked(writeRemotePipelineDocument).mockReturnValue(pending.promise);
    const first = await mount(remote);
    await screen.findByText("Original");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    await screen.findByText("Saving");
    const document = await storage.loadDocument(remote);
    await act(async () => first.unmount());
    await mount(remote);
    await screen.findByText("Unsaved edit");
    expect(await storage.loadDocument(remote)).toBe(document);
    expect(writeRemotePipelineDocument).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve(server);
      await document.saveState.pendingSave?.promise;
    });
    await screen.findByText("Idle");
    expect(document.saveState.hasUnsavedChanges).toBe(false);
  });

  it("promotes a draft to the same document before observers follow its saved identity", async () => {
    const first = await mount(draft);
    await screen.findByText("Draft");
    const document = await storage.loadDocument(draft);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(document.file.remote).toBeDefined());
    expect(await storage.loadDocument(remote)).toBe(document);
    await act(async () => first.rerender(view(remote)));
    await screen.findByText("Unsaved edit");
    expect(screen.getByText("Undo")).toBeEnabled();
    expect(getPipelineDocument).not.toHaveBeenCalled();
    expect(addRecentlyViewed).toHaveBeenLastCalledWith(
      { type: "pipeline", id: remote.pipelineId, name: "Draft" },
      remote.backendUrl,
    );
  });

  it("does not evict a newer failed edit when an older write succeeds", async () => {
    const pending = Promise.withResolvers<SavedPipelineDocument>();
    vi.mocked(writeRemotePipelineDocument)
      .mockReturnValueOnce(pending.promise)
      .mockRejectedValue(new Error("New save failed"));
    const first = await mount(remote);
    await screen.findByText("Original");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    fireEvent.click(screen.getByText("Edit again"));
    fireEvent.click(screen.getByText("Save"));
    await act(async () => first.unmount());
    await act(async () => pending.resolve(server));
    const document = await storage.loadDocument(remote);
    await act(async () => {
      await document.saveState.pendingSave?.promise.catch(() => {});
    });
    await mount(remote);
    await screen.findByText("Newer edit");
    await screen.findByText("New save failed");
    expect(getPipelineDocument).toHaveBeenCalledOnce();
  });

  it("isolates identical pipeline IDs by backend", async () => {
    const first = await storage.loadDocument(remote);
    const other = { ...remote, backendUrl: "https://other.example.com" };
    const second = await storage.loadDocument(other);
    loaded.add(first);
    loaded.add(second);
    expect(first.spec).not.toBe(second.spec);
    expect(first.saveState).not.toBe(second.saveState);
    expect(getPipelineDocument).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "reconciles deletion while preserving dirty edits (dirty: %s)",
    async (dirty) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const ref = { ...remote, pipelineId: `deleted-${dirty}` };
      const first = await mount(ref);
      await screen.findByText("Original");
      if (dirty) fireEvent.click(screen.getByText("Edit"));
      await act(async () => {
        await withRemotePipelineDeletion(
          ref,
          `pipelines/deleted-${dirty}.yaml`,
          async () => {},
        );
      });
      if (dirty) {
        await screen.findByText(
          "This pipeline was deleted. Save a copy to keep your changes.",
        );
        await act(async () => first.unmount());
        await mount(ref);
        await screen.findByText("Unsaved edit");
        expect(getPipelineDocument).toHaveBeenCalledOnce();
      } else {
        await screen.findByText("Retry load");
      }
      expect(writeRemotePipelineDocument).not.toHaveBeenCalled();
    },
  );

  it("retries a failed load through the shared error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getPipelineDocument).mockRejectedValueOnce(
      new Error("Load unavailable"),
    );
    const mounted = await mount(remote);
    await act(async () =>
      fireEvent.click(await screen.findByText("Retry load")),
    );
    await screen.findByText("Original");
    expect(getPipelineDocument).toHaveBeenCalledTimes(2);
    const document = await storage.loadDocument(remote);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(document.saveState.hasUnsavedChanges).toBe(false),
    );
    expect(storage.getFile(remote)).toBe(document.file);
    expect(isRootStore(document.spec)).toBe(true);
    await act(async () => mounted.unmount());
    expect(storage.getFile(remote)).toBeUndefined();
    expect(isRootStore(document.spec)).toBe(false);
  });
});
