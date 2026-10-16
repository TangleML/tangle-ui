import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listRemotePipelines,
  type RemotePipeline,
} from "@/services/remotePipelinesService";
import { formatDate } from "@/utils/date";

import { DashboardPipelinesView } from "./DashboardPipelinesView";

vi.mock("@/components/Home/PipelineSection/PipelineSection", () => ({
  PipelineSection: () => <div>Local pipeline list</div>,
}));

vi.mock("./FavoritesPreview", () => ({
  FavoritesPreview: () => <div>Favorite Pipelines</div>,
}));

let backend = {
  backendUrl: "https://backend.example.com",
  configured: true,
  available: true,
  ready: true,
};

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

vi.mock("@/services/remotePipelinesService");

const pipeline: RemotePipeline = {
  id: "pipeline-1",
  user_id: "user@example.com",
  pipeline_name: "Example pipeline",
  created_at: "2026-09-22T17:26:29Z",
  updated_at: "2026-09-23T17:26:29Z",
  current_version: "version-1",
};

const clients: QueryClient[] = [];

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    ...render(<DashboardPipelinesView />, { wrapper }),
    user: userEvent.setup(),
  };
}

beforeEach(() => {
  backend = {
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
    ready: true,
  };
  vi.mocked(listRemotePipelines).mockResolvedValue([pipeline]);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.resetAllMocks();
});

describe("DashboardPipelinesView remote pipelines", () => {
  it("fetches only when the remote tab opens and displays the returned metadata", async () => {
    const { user } = renderDashboard();

    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
    expect(listRemotePipelines).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    const row = (await screen.findByText("Example pipeline")).closest("tr")!;
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Example pipeline",
      "pipeline-1",
      "user@example.com",
      formatDate(pipeline.created_at),
      formatDate(pipeline.updated_at),
      "version-1",
    ]);
    expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
      backend.backendUrl,
    );
    expect(screen.getByText("Favorite Pipelines")).toBeInTheDocument();
    expect(screen.queryByText("Local pipeline list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Local Pipelines" }));
    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
  });

  it("shows a loading message while the request is pending", async () => {
    vi.mocked(listRemotePipelines).mockReturnValue(new Promise(() => {}));
    const { user } = renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(screen.getByText("Loading remote pipelines…")).toBeInTheDocument();
  });

  it("shows an empty result clearly", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue([]);
    const { user } = renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(
      await screen.findByText("No remote pipelines found."),
    ).toBeInTheDocument();
  });

  it("shows an API failure instead of an empty result", async () => {
    vi.mocked(listRemotePipelines).mockRejectedValue(
      new Error("Request failed"),
    );
    const { user } = renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(
      await screen.findByText("Failed to load remote pipelines."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No remote pipelines found."),
    ).not.toBeInTheDocument();
  });

  it.each([
    [{ ready: false }, "Loading remote pipelines…"],
    [{ configured: false }, "Configure a backend to view remote pipelines."],
    [{ available: false }, "Backend is unavailable."],
  ])("does not fetch when the backend state is %o", async (state, message) => {
    backend = { ...backend, ...state };
    const { user } = renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(listRemotePipelines).not.toHaveBeenCalled();
  });

  it("keeps unnamed pipelines in the table", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue([
      { ...pipeline, pipeline_name: null },
    ]);
    const { user } = renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(await screen.findByText("Untitled Pipeline")).toBeInTheDocument();
    expect(screen.getByText("pipeline-1")).toBeInTheDocument();
  });

  it("opens another backend without reusing the previous backend's rows", async () => {
    const { user, rerender } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Example pipeline");

    backend = { ...backend, backendUrl: "https://other.example.com" };
    vi.mocked(listRemotePipelines).mockResolvedValue([
      { ...pipeline, id: "pipeline-2", pipeline_name: "Other pipeline" },
    ]);
    rerender(<DashboardPipelinesView key={backend.backendUrl} />);
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(await screen.findByText("Other pipeline")).toBeInTheDocument();
    expect(screen.queryByText("Example pipeline")).not.toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      "https://other.example.com",
    );
  });
});
