import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorPipelineRef } from "@/services/pipelineStorage/types";

import { useLoadSpec } from "./useLoadSpec";

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
