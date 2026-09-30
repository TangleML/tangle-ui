import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ONE_MINUTE_IN_MS } from "@/utils/constants";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { PipelineStorageProvider } from "./PipelineStorageProvider";
import { FoldersQueryKeys } from "./types";

vi.mock("@/utils/remotePipelines", () => ({
  REMOTE_PIPELINES_ENABLED: false,
}));
vi.mock("./PipelineStorageService", () => ({
  PipelineStorageService: class {
    readonly scope = "test-scope";
  },
}));

const remoteKey = [
  ...FoldersQueryKeys.All(),
  "remote-list",
  "test-scope",
  "pages",
  { userId: "me" },
];
const localKey = [...FoldersQueryKeys.All(), "flat-list", "test-scope"];
const folderKey = [...FoldersQueryKeys.Pipelines(null), "test-scope"];
const unrelatedKey = ["pipelineRuns"];

function CachedPipelineList({ load }: { load: () => Promise<string[]> }) {
  const { data } = useQuery({
    queryKey: remoteKey,
    queryFn: load,
    staleTime: 5 * ONE_MINUTE_IN_MS,
  });
  return <div>{data?.join(", ")}</div>;
}

describe("PipelineStorageProvider cache invalidation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 5 * ONE_MINUTE_IN_MS },
      },
    });
  });

  afterEach(() => {
    cleanup();
    client.clear();
  });

  it("refreshes fresh inactive pipeline lists after a save away from the listing page", async () => {
    client.setQueryData(remoteKey, ["Previously saved pipeline"]);
    client.setQueryData(localKey, ["Local draft"]);
    client.setQueryData(folderKey, ["Local draft"]);
    client.setQueryData(unrelatedKey, ["Existing run"]);
    const load = vi.fn(async () => ["Published pipeline"]);
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <PipelineStorageProvider>{null}</PipelineStorageProvider>
      </QueryClientProvider>,
    );

    expect(client.getQueryState(remoteKey)?.isInvalidated).toBe(false);
    await act(async () => emitUserPipelineWritten());

    for (const queryKey of [remoteKey, localKey, folderKey]) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
    expect(client.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
    expect(load).not.toHaveBeenCalled();

    rerender(
      <QueryClientProvider client={client}>
        <PipelineStorageProvider>
          <CachedPipelineList load={load} />
        </PipelineStorageProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Published pipeline")).toBeInTheDocument();
    expect(load).toHaveBeenCalledOnce();
  });

  it("unsubscribes when the storage provider unmounts", async () => {
    client.setQueryData(remoteKey, []);
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <PipelineStorageProvider>{null}</PipelineStorageProvider>
      </QueryClientProvider>,
    );

    unmount();
    await act(async () => emitUserPipelineWritten());

    expect(client.getQueryState(remoteKey)?.isInvalidated).toBe(false);
  });
});
