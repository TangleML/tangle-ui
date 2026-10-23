import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { listLocalPipelineNames } from "@/services/localPipelines/localPipelinesService";
import { LocalPipelinesQueryKeys } from "@/services/localPipelines/types";

import { DashboardPipelinesView } from "./DashboardPipelinesView";

const state = vi.hoisted(() => ({
  backend: { configured: true, ready: true, available: true },
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
  useSearch: () => state.search,
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => state.backend,
}));
vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  listLocalPipelineNames: vi.fn(),
}));
vi.mock("@/components/Home/PipelineSection/PipelineSection", () => ({
  PipelineSection: () => <p>Local pipeline list</p>,
}));
vi.mock("./RemotePipelinesTable", () => ({
  RemotePipelinesTable: () => <p>Remote pipeline list</p>,
}));
vi.mock("./FavoritesPreview", () => ({ FavoritesPreview: () => null }));

const clients: QueryClient[] = [];

function openDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const view = () => (
    <QueryClientProvider client={client}>
      <DashboardPipelinesView />
    </QueryClientProvider>
  );
  const rendered = render(view());
  return { client, refresh: () => rendered.rerender(view()) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  state.backend = { configured: true, ready: true, available: true };
  state.search = {};
  vi.mocked(listLocalPipelineNames).mockResolvedValue(["Local pipeline"]);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllEnvs();
});

it.each(["remote disabled", "no backend", "no opt-in"])(
  "shows only local pipelines for %s, even with a remote URL selection",
  async (mode) => {
    if (mode === "remote disabled")
      vi.stubEnv("VITE_REMOTE_PIPELINES", "false");
    else if (mode === "no backend") state.backend.configured = false;
    else vi.stubEnv("VITE_REMOTE_PIPELINES", undefined);
    state.search = { tab: "remote", page: 2, name: "Missing pipeline" };
    openDashboard();
    expect(await screen.findByText("Local pipeline list")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("Remote pipeline list")).not.toBeInTheDocument();
  },
);

it("shows only remote pipelines when the local inventory is empty", async () => {
  vi.mocked(listLocalPipelineNames).mockResolvedValue([]);
  state.search = { tab: "local" };
  openDashboard();
  expect(await screen.findByText("Remote pipeline list")).toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.queryByText("Local pipeline list")).not.toBeInTheDocument();
});

it("shows remote first and selected when local pipelines exist", async () => {
  openDashboard();
  expect(
    await screen.findByRole("tab", { name: "Remote Pipelines" }),
  ).toHaveAttribute("aria-selected", "true");
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Remote Pipelines",
    "Local Pipelines",
  ]);
  expect(screen.getByText("Remote pipeline list")).toBeInTheDocument();
});

it("keeps both tabs for a filtered remote view", async () => {
  state.search = { name: "No matching pipeline" };
  openDashboard();
  expect(
    await screen.findByRole("tab", { name: "Remote Pipelines" }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    screen.getByRole("tab", { name: "Local Pipelines" }),
  ).toBeInTheDocument();
  expect(listLocalPipelineNames).toHaveBeenCalledWith(expect.anything());
});

it("waits for local enumeration instead of treating it as empty", async () => {
  const inventory = Promise.withResolvers<string[]>();
  vi.mocked(listLocalPipelineNames).mockReturnValue(inventory.promise);
  openDashboard();
  expect(screen.getByText("Loading pipelines…")).toBeInTheDocument();
  expect(screen.queryByText("Remote pipeline list")).not.toBeInTheDocument();
  await act(async () => inventory.resolve(["Local pipeline"]));
  expect(await screen.findByRole("tablist")).toBeInTheDocument();
});

it("waits for backend settings before choosing a mode", async () => {
  state.backend = { configured: false, ready: false, available: false };
  vi.mocked(listLocalPipelineNames).mockResolvedValue([]);
  const { refresh } = openDashboard();
  expect(screen.getByText("Loading pipelines…")).toBeInTheDocument();
  state.backend = { configured: true, ready: true, available: true };
  refresh();
  expect(await screen.findByText("Remote pipeline list")).toBeInTheDocument();
});

it("retains access to local pipelines when enumeration fails", async () => {
  state.search = { tab: "local" };
  vi.mocked(listLocalPipelineNames).mockRejectedValue(
    new Error("Storage unavailable"),
  );
  openDashboard();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load the local pipeline list.",
  );
  expect(
    screen.getByRole("tab", { name: "Local Pipelines" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
});

it("keeps remote mode during an outage and background inventory refresh", async () => {
  vi.mocked(listLocalPipelineNames).mockResolvedValue([]);
  const { client, refresh } = openDashboard();
  await screen.findByText("Remote pipeline list");
  const inventory = Promise.withResolvers<string[]>();
  vi.mocked(listLocalPipelineNames).mockReturnValue(inventory.promise);
  void client.invalidateQueries({ queryKey: LocalPipelinesQueryKeys.Names() });
  state.backend.available = false;
  refresh();
  expect(screen.getByText("Remote pipeline list")).toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  await act(async () => inventory.resolve([]));
});

it("switches to remote only after the last local pipeline is removed", async () => {
  const { client } = openDashboard();
  await screen.findByRole("tablist");
  vi.mocked(listLocalPipelineNames).mockResolvedValue([]);
  await act(async () => {
    await client.invalidateQueries({ queryKey: LocalPipelinesQueryKeys.All() });
  });
  await waitFor(() =>
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Remote pipeline list")).toBeInTheDocument();
});
