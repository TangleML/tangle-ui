import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorPipelineRef } from "@/services/pipelineStorage/types";

import { useLoadSpec } from "./useLoadSpec";

const resolvePipeline = vi.hoisted(() => vi.fn());
const discardRemoteDraft = vi.hoisted(() => vi.fn());
const storage = { resolvePipeline, discardRemoteDraft };
const loadUndoHistory = vi.hoisted(() => vi.fn().mockResolvedValue(null));
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
    createUndoStoreWithEvents: vi.fn(),
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
function view(pipelineRef: EditorPipelineRef) {
  return (
    <StrictMode>
      <QueryClientProvider client={client}>
        <Suspense fallback={null}>
          <Parent pipelineRef={pipelineRef} />
        </Suspense>
      </QueryClientProvider>
    </StrictMode>
  );
}

afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

describe("useLoadSpec", () => {
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
    await act(async () => opened.unmount());
    expect(discardRemoteDraft).toHaveBeenCalledWith(draft);
  });
  it("keeps nested StrictMode observers stable, then reloads a closed remote document", async () => {
    resolvePipeline.mockResolvedValue(file("Before", remote));
    const first = render(view(remote));
    await screen.findByText("Before");
    expect(resolvePipeline).toHaveBeenCalledExactlyOnceWith(remote);
    expect(loadUndoHistory).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(["remote-pipeline", remote.backendUrl, remote.pipelineId]),
      expect.stringContaining("Before"),
    );
    await act(async () => first.unmount());
    resolvePipeline.mockResolvedValue(file("After", remote));
    render(view(remote));
    await screen.findByText("After");
    expect(resolvePipeline).toHaveBeenCalledTimes(2);
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
  });
});
