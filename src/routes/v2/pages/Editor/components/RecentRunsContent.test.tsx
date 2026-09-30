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
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineRunResponse } from "@/api/types.gen";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineRunFilters } from "@/types/pipelineRunFilters";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";
import {
  SAVED_PIPELINE_ID_ANNOTATION,
  SOURCE_PIPELINE_ID_ANNOTATION,
} from "@/utils/pipelineRunSource";

import { RecentRunsContent } from "./RecentRunsContent";

const BACKEND = "https://backend.example";
const PIPELINE_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_ID = "00000000-0000-4000-8000-000000000002";
const mockRoot = observable({ name: "Report" });
const mockFile = observable<{
  storageKind: PipelineFile["storageKind"];
  remoteId?: string;
  remoteBackendUrl?: string;
}>({ storageKind: "local" });
const mockBackend = { backendUrl: BACKEND, configured: true, available: true };
const mockFetch = vi.mocked(fetchWithErrorHandling);
let queryClient: QueryClient;

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation: { rootSpec: mockRoot } }),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({ pipelineFile: { activePipelineFile: mockFile } }),
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => mockBackend,
}));
vi.mock("@/utils/fetchWithErrorHandling", () => ({
  fetchWithErrorHandling: vi.fn(),
}));
vi.mock("@/components/shared/PipelineRunDisplay/PipelineRunsList", () => ({
  PipelineRunsList: ({ pipelineName }: { pipelineName?: string }) => (
    <span>Local history: {pipelineName}</span>
  ),
}));
vi.mock("@/routes/runRoutes", () => ({
  getDefaultRunPath: (id: string) => `/runs-v2/${id}`,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    search?: { filter: PipelineRunFilters };
  }) => (
    <a
      {...props}
      href={
        search
          ? `${to}?${new URLSearchParams({ filter: JSON.stringify(search.filter) })}`
          : to
      }
    />
  ),
}));

function run(id = "remote-run"): PipelineRunResponse {
  return {
    id,
    root_execution_id: `execution-${id}`,
    pipeline_name: "Report before rename",
    created_at: "2026-01-01T00:00:00Z",
    execution_status_stats: { SUCCEEDED: 1 },
  };
}

function openRemote(id = PIPELINE_ID, backend = BACKEND) {
  runInAction(() => {
    mockFile.storageKind = "remote";
    mockFile.remoteId = id;
    mockFile.remoteBackendUrl = backend;
  });
}

function renderPanel() {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RecentRunsContent />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  runInAction(() => {
    mockRoot.name = "Report";
    mockFile.storageKind = "local";
    mockFile.remoteId = undefined;
    mockFile.remoteBackendUrl = undefined;
  });
  mockBackend.available = true;
  mockBackend.backendUrl = BACKEND;
  mockFetch.mockResolvedValue({ pipeline_runs: [run()] });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("editor recent runs", () => {
  it.each(["local", "pending"] as const)(
    "keeps browser history for %s pipelines",
    (kind) => {
      mockFile.storageKind = kind;
      renderPanel();
      expect(screen.getByText("Local history: Report")).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it("loads server history by stable ID and keeps it after renaming", async () => {
    openRemote();
    mockBackend.backendUrl = `${BACKEND}/`;
    renderPanel();
    expect(
      await screen.findByRole("link", { name: /^#remote-run\b/ }),
    ).toHaveAttribute("href", "/runs-v2/remote-run");
    const request = new URL(String(mockFetch.mock.calls[0][0]));
    expect(request.origin).toBe(BACKEND);
    expect(
      JSON.parse(request.searchParams.get("filter_query") ?? "null"),
    ).toEqual({
      and: [
        {
          or: [SAVED_PIPELINE_ID_ANNOTATION, SOURCE_PIPELINE_ID_ANNOTATION].map(
            (key) => ({ value_equals: { key, value: PIPELINE_ID } }),
          ),
        },
      ],
    });
    expect(request.searchParams.get("include_execution_stats")).toBe("true");
    expect(screen.queryByText(/Local history/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View all pipeline runs" }),
    ).toHaveAttribute(
      "href",
      `/runs?${new URLSearchParams({ filter: JSON.stringify({ saved_pipeline_id: PIPELINE_ID }) })}`,
    );
    act(() => {
      runInAction(() => {
        mockRoot.name = "Renamed";
      });
    });
    expect(
      screen.getByRole("link", { name: /^#remote-run\b/ }),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("separates two remote pipelines with the same name", async () => {
    openRemote();
    renderPanel();
    await screen.findByRole("link", { name: /^#remote-run\b/ });
    mockFetch.mockResolvedValue({ pipeline_runs: [run("other-run")] });
    act(() => openRemote(SECOND_ID));
    await screen.findByRole("link", { name: /^#other-run\b/ });
    expect(
      screen.queryByRole("link", { name: /^#remote-run\b/ }),
    ).not.toBeInTheDocument();
    expect(String(mockFetch.mock.calls[1][0])).toContain(SECOND_ID);
  });

  it("switches to server history when a local pipeline migrates", async () => {
    renderPanel();
    expect(screen.getByText("Local history: Report")).toBeInTheDocument();
    act(() => openRemote());
    await screen.findByRole("link", { name: /^#remote-run\b/ });
    expect(screen.queryByText(/Local history/)).not.toBeInTheDocument();
  });

  it("refreshes after the existing run-submission cache invalidation", async () => {
    openRemote();
    renderPanel();
    await screen.findByRole("link", { name: /^#remote-run\b/ });
    mockFetch.mockResolvedValue({ pipeline_runs: [run("new-run"), run()] });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["runs", BACKEND] });
    });
    expect(
      await screen.findByRole("link", { name: /^#new-run\b/ }),
    ).toBeInTheDocument();
  });

  it("shows at most ten runs without fetching individual run details", async () => {
    openRemote();
    mockFetch.mockResolvedValue({
      pipeline_runs: Array.from({ length: 12 }, (_, i) => ({
        ...run(`run-${i}`),
        created_at: null,
        execution_status_stats: null,
      })),
      next_page_token: "next",
    });
    renderPanel();
    await screen.findByRole("link", { name: /^#run-0\b/ });
    expect(screen.getAllByRole("link", { name: /^#/ })).toHaveLength(10);
    expect(
      screen.getByRole("link", { name: "View all pipeline runs" }),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state for an empty server history", async () => {
    openRemote();
    mockFetch.mockResolvedValue({ pipeline_runs: [] });
    renderPanel();
    expect(
      await screen.findByText(
        "No runs yet. Submit this pipeline to see runs here.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a failed request and lets the user retry", async () => {
    openRemote();
    mockFetch.mockRejectedValueOnce(new Error("Request failed"));
    renderPanel();
    await screen.findByText("Could not load runs");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("link", { name: /^#remote-run\b/ }),
    ).toBeInTheDocument();
  });

  it("does not query a different backend or fall back to name-based history", () => {
    openRemote(PIPELINE_ID, "https://other.example");
    renderPanel();
    expect(screen.getByText(/Run history is unavailable/)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByText(/Local history/)).not.toBeInTheDocument();
  });

  it("shows backend unavailability instead of loading forever", async () => {
    openRemote();
    mockBackend.available = false;
    renderPanel();
    expect(
      screen.getByText("Connect to the backend to view runs."),
    ).toBeInTheDocument();
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
  });
});
