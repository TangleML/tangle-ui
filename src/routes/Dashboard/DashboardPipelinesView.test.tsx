import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createContext, type ReactNode, useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listRemotePipelines,
  type RemotePipeline,
  type RemotePipelinesPage,
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
const BackendContext = createContext(backend);

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => useContext(BackendContext),
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

function createPage(
  start: number,
  count: number,
  totalCount: number,
  nextPageToken: string | null,
): RemotePipelinesPage {
  return {
    pipelines: Array.from({ length: count }, (_, index) => ({
      ...pipeline,
      id: `pipeline-${start + index}`,
      pipeline_name: `Pipeline ${start + index}`,
    })),
    totalCount,
    nextPageToken,
  };
}

function expectNoPaginationControls() {
  expect(
    screen.queryByRole("button", { name: "First page" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Previous" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Next" }),
  ).not.toBeInTheDocument();
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <BackendContext.Provider value={backend}>
        {children}
      </BackendContext.Provider>
    </QueryClientProvider>
  );
  return {
    ...render(<DashboardPipelinesView />, { wrapper }),
    user: userEvent.setup(),
  };
}

async function renderResizableTable() {
  const { user } = renderDashboard();
  await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
  await screen.findByText("Example pipeline");

  const table = screen.getByRole("table", { name: "Remote Pipelines" });
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 1000, 0),
  );
  const handle = within(table).getByRole("separator", {
    name: "Resize User column",
  });
  Object.assign(handle, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  });

  const widths = () =>
    within(table)
      .getAllByRole("columnheader")
      .map((header) => Number.parseFloat(header.style.width));
  const startDrag = () =>
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 600,
    });
  const dragTo = (clientX: number) =>
    fireEvent.pointerMove(handle, { pointerId: 1, clientX });

  return { table, handle, widths, startDrag, dragTo };
}

beforeEach(() => {
  backend = {
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
    ready: true,
  };
  vi.mocked(listRemotePipelines).mockResolvedValue({
    pipelines: [pipeline],
    totalCount: 1,
    nextPageToken: null,
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("DashboardPipelinesView remote pipelines", () => {
  it("fetches only when the remote tab opens and displays the returned metadata", async () => {
    const { user } = renderDashboard();

    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
    expect(listRemotePipelines).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    const row = await screen.findByRole("row", { name: /Example pipeline/ });
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
      undefined,
    );
    expectNoPaginationControls();
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
    expectNoPaginationControls();
    expect(listRemotePipelines).toHaveBeenCalledTimes(1);
  });

  it("shows an empty result clearly", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue({
      pipelines: [],
      totalCount: 0,
      nextPageToken: null,
    });
    const { user } = renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(
      await screen.findByText("No remote pipelines found."),
    ).toBeInTheDocument();
    expectNoPaginationControls();
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
    expectNoPaginationControls();
    expect(listRemotePipelines).not.toHaveBeenCalled();
  });

  it("keeps unnamed pipelines in the table", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue({
      pipelines: [{ ...pipeline, pipeline_name: null }],
      totalCount: 1,
      nextPageToken: null,
    });
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
    vi.mocked(listRemotePipelines).mockResolvedValue({
      pipelines: [
        { ...pipeline, id: "pipeline-2", pipeline_name: "Other pipeline" },
      ],
      totalCount: 1,
      nextPageToken: null,
    });
    rerender(<DashboardPipelinesView />);

    expect(await screen.findByText("Other pipeline")).toBeInTheDocument();
    expect(screen.queryByText("Example pipeline")).not.toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      "https://other.example.com",
      undefined,
    );
  });

  it("uses the returned cursors to show ten records per page and a partial final page", async () => {
    const pages = new Map<string | undefined, RemotePipelinesPage>([
      [undefined, createPage(1, 10, 25, "page-two")],
      ["page-two", createPage(11, 10, 25, "page-three")],
      ["page-three", createPage(21, 5, 25, null)],
    ]);
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      const page = pages.get(pageToken);
      if (!page) throw new Error(`Unexpected page token: ${pageToken}`);
      return page;
    });
    const { user } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    await screen.findByText("Pipeline 1");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Remote Pipelines" });
    const rows = () => within(table).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(10);
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      1,
      backend.backendUrl,
      undefined,
    );
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 1")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(10);
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      2,
      backend.backendUrl,
      "page-two",
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 21");
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      3,
      backend.backendUrl,
      "page-three",
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    });
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      "page-two",
    );

    await user.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Pipeline 1");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await waitFor(() => {
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
      );
    });
  });

  it("returns to the first page and clears cursor history with the First page button", async () => {
    const pages = new Map<string | undefined, RemotePipelinesPage>([
      [undefined, createPage(1, 10, 25, "page-two")],
      ["page-two", createPage(11, 10, 25, "page-three")],
      ["page-three", createPage(21, 5, 25, null)],
    ]);
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      const page = pages.get(pageToken);
      if (!page) throw new Error(`Unexpected page token: ${pageToken}`);
      return page;
    });
    const { user } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 21");
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "First page" }));
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      undefined,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      "page-two",
    );
  });

  it("disables navigation until the next page request settles", async () => {
    let resolveNextPage: ((page: RemotePipelinesPage) => void) | undefined;
    const nextPage = new Promise<RemotePipelinesPage>((resolve) => {
      resolveNextPage = resolve;
    });
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage(1, 10, 20, "page-two"))
      .mockReturnValueOnce(nextPage);
    const { user } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Loading remote pipelines…")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "First page" }));
    expect(listRemotePipelines).toHaveBeenCalledTimes(2);

    await act(async () => {
      if (!resolveNextPage) {
        throw new Error("Next-page resolver was not initialized");
      }
      resolveNextPage(createPage(11, 10, 20, null));
    });
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps recovery controls when the pipeline count shrinks on a later page", async () => {
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage(1, 10, 20, "page-two"))
      .mockResolvedValueOnce(createPage(11, 0, 8, null))
      .mockResolvedValueOnce(createPage(1, 8, 8, null));
    const { user } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByText("No remote pipelines found."),
    ).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "First page" }));
    const table = screen.getByRole("table", { name: "Remote Pipelines" });
    await waitFor(() => {
      expect(within(table).getAllByRole("row").slice(1)).toHaveLength(8);
      expectNoPaginationControls();
    });
    expect(screen.getByText("Pipeline 1")).toBeInTheDocument();
    expect(
      screen.queryByText("No remote pipelines found."),
    ).not.toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      3,
      backend.backendUrl,
      undefined,
    );
  });

  it("allows returning to the previous page after a next page request fails", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      if (pageToken) throw new Error("Request failed");
      return createPage(1, 10, 20, "page-two");
    });
    const { user } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByText("Failed to load remote pipelines."),
    ).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(
      screen.queryByText("Failed to load remote pipelines."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables every page control when the backend becomes unavailable", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) =>
      pageToken
        ? createPage(11, 10, 30, "page-three")
        : createPage(1, 10, 30, "page-two"),
    );
    const { user, rerender } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");

    backend = { ...backend, available: false };
    rerender(<DashboardPipelinesView />);

    expect(screen.getByText("Backend is unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "First page" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(listRemotePipelines).toHaveBeenCalledTimes(2);
  });

  it("resets to the first page when the backend changes without remounting", async () => {
    const originalBackendUrl = backend.backendUrl;
    vi.mocked(listRemotePipelines).mockImplementation(
      async (url, pageToken) => {
        if (url !== originalBackendUrl) return createPage(101, 1, 1, null);
        return pageToken
          ? createPage(11, 10, 20, null)
          : createPage(1, 10, 20, "original-page-two");
      },
    );
    const { user, rerender } = renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");

    backend = { ...backend, backendUrl: "https://other.example.com" };
    rerender(<DashboardPipelinesView />);

    expect(await screen.findByText("Pipeline 101")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 11")).not.toBeInTheDocument();
    expectNoPaginationControls();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      undefined,
    );
    expect(listRemotePipelines).not.toHaveBeenCalledWith(
      backend.backendUrl,
      "original-page-two",
    );
  });

  it("redistributes a dragged column's width equally to the columns on its right", async () => {
    const { table, handle, widths, startDrag, dragTo } =
      await renderResizableTable();

    expect(within(table).getAllByRole("separator")).toHaveLength(5);
    startDrag();
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    dragTo(690);

    expect(widths()).toEqual([25, 15, 29, 9, 9, 13]);
    expect(widths().reduce((total, width) => total + width, 0)).toBe(100);
    expect(screen.getByText(pipeline.user_id)).toHaveAttribute(
      "title",
      pipeline.user_id,
    );

    dragTo(630);
    expect(widths()).toEqual([25, 15, 23, 11, 11, 15]);
  });

  it("keeps columns above their minimum width during large drags", async () => {
    const { widths, startDrag, dragTo } = await renderResizableTable();

    startDrag();
    dragTo(1600);
    expect(widths()).toEqual([25, 15, 32, 8, 8, 12]);

    dragTo(-400);
    expect(widths()).toEqual([25, 15, 8, 16, 16, 20]);
  });

  it.each<"pointerUp" | "pointerCancel" | "lostPointerCapture">([
    "pointerUp",
    "pointerCancel",
    "lostPointerCapture",
  ])("stops resizing after %s", async (event) => {
    const { handle, widths, startDrag, dragTo } = await renderResizableTable();

    startDrag();
    dragTo(690);
    fireEvent[event](handle, { pointerId: 1 });
    dragTo(750);

    expect(widths()).toEqual([25, 15, 29, 9, 9, 13]);
  });

  it("keeps resizing when a different pointer ends on another handle", async () => {
    const { table, widths, startDrag, dragTo } = await renderResizableTable();
    const otherHandle = within(table).getByRole("separator", {
      name: "Resize ID column",
    });

    startDrag();
    fireEvent.pointerUp(otherHandle, { pointerId: 2 });
    dragTo(690);

    expect(widths()).toEqual([25, 15, 29, 9, 9, 13]);
  });

  it("lets a focused resize handle adjust columns with arrow keys", async () => {
    const { handle, widths } = await renderResizableTable();
    handle.focus();
    expect(handle).toHaveFocus();

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    const expandedWidths = widths();
    expect(expandedWidths.slice(0, 3)).toEqual([25, 15, 21]);
    [12, 12, 16].forEach((width, index) => {
      expect(expandedWidths[index + 3]).toBeCloseTo(width - 1 / 3);
    });
    expect(
      expandedWidths.reduce((total, width) => total + width, 0),
    ).toBeCloseTo(100);

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    widths().forEach((width, index) => {
      expect(width).toBeCloseTo([25, 15, 20, 12, 12, 16][index]);
    });
  });
});
