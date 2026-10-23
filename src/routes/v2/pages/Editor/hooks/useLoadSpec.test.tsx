import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { observer } from "mobx-react-lite";
import { StrictMode, Suspense, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";

import { EDITOR_SPEC_QUERY_KEY, useLoadSpec } from "./useLoadSpec";

const resolvePipeline = vi.hoisted(() => vi.fn());
const loadUndoHistory = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => ({ resolvePipeline }),
}));
vi.mock("@/routes/v2/pages/Editor/utils/undoHistoryStorage", () => ({
  loadUndoHistory,
  createUndoStoreWithEvents: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));

const client = new QueryClient();
const remote = {
  source: "remote",
  backendUrl: "https://backend.example.com",
  pipelineId: "pipeline-1",
} as const;
const local = { name: "Original", fileId: "local-1" };
const file = (name: string) => ({
  storageKey: name,
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
  const [autoSave] = useState(() => new AutoSaveStore(new UndoStore()));
  useEffect(() => {
    autoSave.init(data.spec, data.file, data.saveState);
    return () => autoSave.dispose();
  }, [autoSave, data]);
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
  vi.useRealTimers();
  cleanup();
  client.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("useLoadSpec", () => {
  it("keeps nested StrictMode observers stable, then reloads a closed remote document", async () => {
    resolvePipeline.mockResolvedValue(file("Before"));
    const first = render(view(remote));
    await screen.findByText("Before");
    expect(resolvePipeline).toHaveBeenCalledExactlyOnceWith(remote);
    expect(loadUndoHistory).not.toHaveBeenCalled();
    await act(async () => first.unmount());
    resolvePipeline.mockResolvedValue(file("After"));
    render(view(remote));
    await screen.findByText("After");
    expect(resolvePipeline).toHaveBeenCalledTimes(2);
  });

  it.each([remote, local])(
    "retains failed edits after unmount and retries them from the saved baseline: %j",
    async (pipelineRef) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const write = vi.fn().mockRejectedValue(new Error("Save unavailable"));
      resolvePipeline.mockResolvedValue({ ...file("Original"), write });
      const first = render(view(pipelineRef, true));
      await screen.findByText("Original");
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Save"));
      await screen.findByText("Save unavailable");
      if (!("source" in pipelineRef)) vi.useFakeTimers();
      await act(async () => first.unmount());
      if (!("source" in pipelineRef)) {
        await act(async () => vi.advanceTimersByTimeAsync(6 * 60_000));
        vi.useRealTimers();
      }
      await waitFor(() => expect(write).toHaveBeenCalledTimes(2));

      const reopened = render(view(pipelineRef, true));
      await screen.findByText("Unsaved edit");
      await screen.findByText("Save unavailable");
      expect(resolvePipeline).toHaveBeenCalledTimes(1);
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

  it.each([remote, local])(
    "keeps an in-flight edit through reopen without duplicating its write: %j",
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
      await act(async () => reopened.unmount());
      finish();
      await waitFor(() =>
        expect(client.getQueryCache().getAll()).toHaveLength(0),
      );
    },
  );

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
    resolvePipeline.mockResolvedValue(file("First backend"));
    const { rerender } = render(view(remote));
    await screen.findByText("First backend");
    const other = { ...remote, backendUrl: "https://other.example.com" };
    resolvePipeline.mockResolvedValue(file("Second backend"));
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
    expect(loadUndoHistory).toHaveBeenCalledExactlyOnceWith("Current name");
  });
});
