import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode, Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EDITOR_SPEC_QUERY_KEY, useLoadSpec } from "./useLoadSpec";

const { file, storage, loadUndoHistory } = vi.hoisted(() => {
  const file = { storageKind: "remote", read: vi.fn() };
  return {
    file,
    storage: {
      scope: "account-a",
      remoteEnabled: true,
      findPipelineById: vi.fn(async () => file),
    },
    loadUndoHistory: vi.fn(async () => null),
  };
});

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/services/pipelineStorage/drivers/RootFolderDbStorageDriver", () => ({
  RootFolderDbStorageDriver: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/utils/undoHistoryStorage", () => ({
  loadUndoHistory,
  createUndoStoreWithEvents: vi.fn(),
}));

function LoadedPipeline({ sessionId }: { sessionId: string }) {
  const { data } = useLoadSpec(
    { name: "Shared name", fileId: "remote-id" },
    sessionId,
  );
  return <div>{data.spec.description}</div>;
}

function openPipeline(client: QueryClient, sessionId = "session-a") {
  return render(
    <QueryClientProvider client={client}>
      <StrictMode>
        <Suspense fallback="Loading">
          <LoadedPipeline sessionId={sessionId} />
        </Suspense>
      </StrictMode>
    </QueryClientProvider>,
  );
}

describe("useLoadSpec remote definitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.scope = "account-a";
    file.storageKind = "remote";
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
      "remote-id",
      "session-a",
    ]);
    expect(data).toMatchObject({ file });
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
