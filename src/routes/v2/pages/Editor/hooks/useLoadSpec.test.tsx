import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/models/componentSpec";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { EDITOR_SPEC_QUERY_KEY, useLoadSpec } from "./useLoadSpec";

const { file, storage, loadUndoHistory } = vi.hoisted(() => {
  const file = {
    id: "document-id",
    storageKind: "remote" as PipelineFile["storageKind"],
    storageKey: "Shared name",
    referenceId: "Shared name",
    read: vi.fn<() => Promise<string>>(),
  } satisfies Pick<
    PipelineFile,
    "id" | "storageKind" | "storageKey" | "referenceId" | "read"
  >;
  return {
    file,
    storage: {
      scope: "account-a",
      remoteEnabled: true,
    },
    loadUndoHistory: vi.fn(async () => null),
  };
});

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/utils/undoHistoryStorage", () => ({
  loadUndoHistory,
  createUndoStoreWithEvents: vi.fn(),
}));

function LoadedPipeline({ sessionId }: { sessionId: string }) {
  const { data } = useLoadSpec(file, sessionId);
  return <div>{data.spec.description}</div>;
}

function pipelineView(client: QueryClient, sessionId = "session-a") {
  return (
    <QueryClientProvider client={client}>
      <StrictMode>
        <Suspense fallback="Loading">
          <LoadedPipeline sessionId={sessionId} />
        </Suspense>
      </StrictMode>
    </QueryClientProvider>
  );
}

function openPipeline(client: QueryClient, sessionId = "session-a") {
  return render(pipelineView(client, sessionId));
}

describe("useLoadSpec remote definitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.scope = "account-a";
    file.storageKind = "remote";
    file.storageKey = "Shared name";
    file.referenceId = "Shared name";
    file.read.mockResolvedValue(
      "name: Pipeline\ndescription: Current server definition\nimplementation:\n  graph:\n    tasks: {}\n",
    );
  });

  it("loads the resolved file in account-scoped cache without local undo history", async () => {
    const client = new QueryClient();
    const view = openPipeline(client);
    await screen.findByText("Current server definition");
    expect(file.read).toHaveBeenCalledOnce();
    expect(loadUndoHistory).not.toHaveBeenCalled();
    const data = client.getQueryData([
      EDITOR_SPEC_QUERY_KEY,
      "account-a",
      "document-id",
      "session-a",
    ]);
    expect(data).toMatchObject({
      spec: { description: "Current server definition" },
    });
    view.unmount();
    client.clear();
  });

  it("keeps the loaded model and undo history when publication changes the locator", async () => {
    const client = new QueryClient();
    file.storageKind = "local";
    const view = openPipeline(client);
    await screen.findByText("Current server definition");
    const queryKey = [
      EDITOR_SPEC_QUERY_KEY,
      "account-a",
      "document-id",
      "session-a",
    ];
    const loaded = client.getQueryData<{ spec: ComponentSpec }>(queryKey);
    if (!loaded) throw new Error("Expected a loaded pipeline");
    const undo = new UndoStore();
    undo.init(loaded.spec);
    act(() => loaded.spec.setDescription("Unsaved editor change"));
    expect(undo.canUndo).toBe(true);

    file.storageKind = "remote";
    file.storageKey = "remote:backend:server-id";
    file.referenceId = file.storageKey;
    view.rerender(pipelineView(client));

    expect(client.getQueryData(queryKey)).toBe(loaded);
    expect(file.read).toHaveBeenCalledTimes(1);
    expect(undo.canUndo).toBe(true);
    act(() => undo.undo());
    expect(loaded.spec.description).toBe("Current server definition");
    undo.dispose();
    view.unmount();
    client.clear();
  });

  it("fetches a fresh server definition when reopening the pipeline", async () => {
    const client = new QueryClient();
    const first = openPipeline(client);
    await screen.findByText("Current server definition");
    first.unmount();
    await Promise.resolve();
    file.read.mockResolvedValue(
      "name: Pipeline\ndescription: Saved by another computer\nimplementation:\n  graph:\n    tasks: {}\n",
    );
    const second = openPipeline(client, "session-b");
    await screen.findByText("Saved by another computer");
    await waitFor(() => expect(file.read).toHaveBeenCalledTimes(2));
    second.unmount();
    client.clear();
  });
});
