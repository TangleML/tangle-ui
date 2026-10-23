import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
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
import { format } from "date-fns";
import { createContext, type ReactNode, useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_ROUTES } from "@/routes/appRoutes";
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

vi.mock("@/services/remotePipelinesService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/remotePipelinesService")
  >()),
  listRemotePipelines: vi.fn(),
}));

const pipeline: RemotePipeline = {
  id: "pipeline-1",
  user_id: "user@example.com",
  pipeline_name: "Example pipeline",
  file_path: "Example pipeline",
  created_at: "2026-09-22T17:26:29Z",
  updated_at: "2026-09-23T17:26:29Z",
  current_version: "version-1",
  versioning_mode: "full",
};

const clients: QueryClient[] = [];

function createPage(
  start: number,
  count: number,
  nextPageToken: string | null,
): RemotePipelinesPage {
  return {
    pipelines: Array.from({ length: count }, (_, index) => ({
      ...pipeline,
      id: `pipeline-${start + index}`,
      pipeline_name: `Pipeline ${start + index}`,
    })),
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

async function renderDashboard(
  initialEntry: string = APP_ROUTES.DASHBOARD_PIPELINES,
) {
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
  const rootRoute = createRootRoute();
  const pipelinesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.DASHBOARD_PIPELINES,
    component: DashboardPipelinesView,
  });
  const history = createMemoryHistory({ initialEntries: [initialEntry] });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pipelinesRoute]),
    history,
    scrollRestoration: true,
  });
  await router.load();
  const rendered = render(<RouterProvider router={router} />, { wrapper });
  return {
    ...rendered,
    rerender: () => rendered.rerender(<RouterProvider router={router} />),
    router,
    searchParams: () =>
      new URL(history.location.href, "http://localhost").searchParams,
    user: userEvent.setup(),
  };
}

async function renderResizableTable() {
  const { user } = await renderDashboard();
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
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  backend = {
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
    ready: true,
  };
  vi.mocked(listRemotePipelines).mockResolvedValue({
    pipelines: [pipeline],
    nextPageToken: null,
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("DashboardPipelinesView remote pipelines", () => {
  it("fetches only when the remote tab opens and displays the returned metadata", async () => {
    const { user } = await renderDashboard();

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
      undefined,
    );
    expectNoPaginationControls();
    expect(screen.getByText("Favorite Pipelines")).toBeInTheDocument();
    expect(screen.queryByText("Local pipeline list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Local Pipelines" }));
    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
  });

  it("searches with all five filters and supports Me and Clear", async () => {
    const { user } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    await screen.findByText("Example pipeline");
    const filters = within(screen.getByLabelText("Remote pipeline filters"));
    const nameInput = filters.getByRole("textbox", { name: "Search by name" });
    const idInput = filters.getByRole("textbox", { name: "Search by ID" });
    const userInput = filters.getByRole("textbox", { name: "Search by user" });
    const pipelineId = "123e4567-e89b-12d3-a456-426614174000";

    await user.type(nameInput, " Different pipeline ");
    await user.type(idInput, pipelineId);
    await user.type(userInput, "another@example.com");
    await waitFor(() =>
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        expect.stringContaining('"value":"another@example.com"'),
      ),
    );
    await user.click(
      filters.getByRole("button", { name: "Clear user filter" }),
    );
    await user.click(filters.getByRole("button", { name: "Me" }));
    expect(userInput).toHaveValue("me");

    const today = new Date();
    const dateFilters = [
      { field: "Created at", day: 10, key: "system/pipeline.date.created_at" },
      { field: "Updated at", day: 20, key: "system/pipeline.date.updated_at" },
    ].map(({ field, day, key }) => ({
      field,
      key,
      from: new Date(today.getFullYear(), today.getMonth() - 1, day),
      to: new Date(today.getFullYear(), today.getMonth() - 1, day + 2),
      end: new Date(today.getFullYear(), today.getMonth() - 1, day + 3),
    }));
    for (const { field, from, to } of dateFilters) {
      const group = filters.getByRole("group", { name: field });
      await user.click(within(group).getByRole("button"));
      const calendar = within(screen.getByRole("dialog"));
      await user.click(
        calendar.getByRole("button", { name: "Go to the Previous Month" }),
      );
      await user.click(
        calendar.getByRole("button", { name: format(from, "PPPP") }),
      );
      await user.click(
        calendar.getByRole("button", { name: format(to, "PPPP") }),
      );
      await user.keyboard("{Escape}");
      expect(within(group).getByRole("button")).toHaveTextContent(
        `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`,
      );
    }

    await waitFor(() =>
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        JSON.stringify({
          and: [
            {
              value_contains: {
                key: "system/pipeline.name",
                value_substring: "Different pipeline",
              },
            },
            { value_equals: { key: "system/pipeline.id", value: pipelineId } },
            { value_equals: { key: "system/pipeline.user_id", value: "me" } },
            ...dateFilters.map(({ key, from, end }) => ({
              time_range: {
                key,
                start_time: from.toISOString(),
                end_time: end.toISOString(),
              },
            })),
          ],
        }),
      ),
    );

    await user.click(
      filters.getByRole("button", { name: "Clear all filters" }),
    );
    expect(nameInput).toHaveValue("");
    expect(idInput).toHaveValue("");
    expect(userInput).toHaveValue("");
    expect(
      filters.getByRole("button", { name: "Created at" }),
    ).toBeInTheDocument();
    expect(
      filters.getByRole("button", { name: "Updated at" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        undefined,
      ),
    );
  });

  it("debounces searches, resets pagination, and preserves the table while fetching", async () => {
    const filteredPage = Promise.withResolvers<RemotePipelinesPage>();
    const filterQuery = JSON.stringify({
      and: [
        {
          value_contains: {
            key: "system/pipeline.name",
            value_substring: "match",
          },
        },
      ],
    });
    vi.mocked(listRemotePipelines).mockImplementation(
      async (_, pageToken, query) => {
        if (!query) {
          return pageToken
            ? createPage(11, 10, null)
            : createPage(1, 10, "unfiltered-two");
        }
        if (!pageToken) return filteredPage.promise;
        if (pageToken === "filtered-two") return createPage(111, 5, null);
        throw new Error(`Unexpected filtered page token: ${pageToken}`);
      },
    );
    const { user, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote&panel=compact`,
    );
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    const table = screen.getByRole("table", { name: "Remote Pipelines" });
    const nameInput = screen.getByRole("textbox", { name: "Search by name" });
    const idInput = screen.getByRole("textbox", { name: "Search by ID" });
    fireEvent.keyDown(
      within(table).getByRole("separator", { name: "Resize User column" }),
      { key: "ArrowRight" },
    );
    const widths = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.style.width);
    vi.mocked(window.scrollTo).mockClear();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(idInput, { target: { value: "123e4567" } });
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(idInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Enter a complete pipeline ID (UUID) to search."),
    ).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenCalledTimes(2);
    fireEvent.change(idInput, { target: { value: "" } });
    fireEvent.change(nameInput, { target: { value: "discarded" } });
    await act(() => vi.advanceTimersByTimeAsync(100));
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(nameInput).toHaveValue("");
    expect(listRemotePipelines).toHaveBeenCalledTimes(2);
    fireEvent.change(nameInput, { target: { value: "match" } });
    await act(() => vi.advanceTimersByTimeAsync(199));
    expect(nameInput).toHaveValue("match");
    expect(listRemotePipelines).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(1));
    vi.useRealTimers();

    await waitFor(() => {
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        filterQuery,
      );
      expect(searchParams().has("page")).toBe(false);
    });
    expect(listRemotePipelines).toHaveBeenCalledTimes(3);
    expect(searchParams().get("panel")).toBe("compact");
    expect(screen.getByRole("table", { name: "Remote Pipelines" })).toBe(table);
    expect(screen.getByText("Pipeline 11")).toBeInTheDocument();
    expect(table).toHaveAttribute("aria-busy", "true");
    expectNoPaginationControls();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.style.width),
    ).toEqual(widths);
    expect(window.scrollTo).not.toHaveBeenCalled();

    await act(async () => {
      filteredPage.resolve(createPage(101, 10, "filtered-two"));
    });
    expect(await screen.findByText("Pipeline 101")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pipeline 111")).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      "filtered-two",
      filterQuery,
    );
    expect(screen.getByText("Page 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    await waitFor(() => {
      expect(searchParams().has("page")).toBe(false);
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        undefined,
      );
    });
    expect(screen.getByRole("table", { name: "Remote Pipelines" })).toBe(table);
    expect(nameInput).toHaveValue("");
  });

  it("keeps the newest search results when an older response arrives later", async () => {
    const olderPage = Promise.withResolvers<RemotePipelinesPage>();
    vi.mocked(listRemotePipelines).mockImplementation(
      async (_, _pageToken, query) => {
        if (query?.includes("older")) return olderPage.promise;
        return query ? createPage(201, 1, null) : createPage(1, 1, null);
      },
    );
    await renderDashboard(`${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`);
    await screen.findByText("Pipeline 1");
    const nameInput = screen.getByRole("textbox", { name: "Search by name" });

    fireEvent.change(nameInput, { target: { value: "older" } });
    await waitFor(() =>
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        expect.stringContaining('"value_substring":"older"'),
      ),
    );
    fireEvent.change(nameInput, { target: { value: "newer" } });
    expect(await screen.findByText("Pipeline 201")).toBeInTheDocument();

    await act(async () => {
      olderPage.resolve(createPage(101, 1, null));
    });
    expect(screen.getByText("Pipeline 201")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 101")).not.toBeInTheDocument();
    expect(nameInput).toHaveValue("newer");
  });

  it("shows a loading message while the request is pending", async () => {
    vi.mocked(listRemotePipelines).mockReturnValue(new Promise(() => {}));
    const { user } = await renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(screen.getByText("Loading pipelines…")).toBeInTheDocument();
    expectNoPaginationControls();
    expect(listRemotePipelines).toHaveBeenCalledTimes(1);
  });

  it("shows an empty result clearly", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue({
      pipelines: [],
      nextPageToken: null,
    });
    const { user } = await renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(await screen.findByText("No pipelines found.")).toBeInTheDocument();
    expectNoPaginationControls();
  });

  it("shows an API failure instead of an empty result", async () => {
    vi.mocked(listRemotePipelines).mockRejectedValue(
      new Error("Request failed"),
    );
    const { user } = await renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(
      await screen.findByText("Failed to load pipelines."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No pipelines found.")).not.toBeInTheDocument();
  });

  it.each([
    [{ ready: false }, "Loading pipelines…"],
    [{ configured: false }, "Configure a backend to view pipelines."],
    [{ available: false }, "Pipelines are unavailable."],
  ])("does not fetch when the backend state is %o", async (state, message) => {
    backend = { ...backend, ...state };
    const { user } = await renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(screen.getByText(message)).toBeInTheDocument();
    expectNoPaginationControls();
    expect(listRemotePipelines).not.toHaveBeenCalled();
  });

  it("keeps unnamed pipelines in the table", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue({
      pipelines: [{ ...pipeline, pipeline_name: null }],
      nextPageToken: null,
    });
    const { user } = await renderDashboard();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    expect(await screen.findByText("Untitled Pipeline")).toBeInTheDocument();
    expect(screen.getByText("pipeline-1")).toBeInTheDocument();
  });

  it("opens another backend without reusing the previous backend's rows", async () => {
    const { user, rerender } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Example pipeline");

    backend = { ...backend, backendUrl: "https://other.example.com" };
    vi.mocked(listRemotePipelines).mockResolvedValue({
      pipelines: [
        { ...pipeline, id: "pipeline-2", pipeline_name: "Other pipeline" },
      ],
      nextPageToken: null,
    });
    rerender();

    expect(await screen.findByText("Other pipeline")).toBeInTheDocument();
    expect(screen.queryByText("Example pipeline")).not.toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      "https://other.example.com",
      undefined,
      undefined,
    );
  });

  it("uses the returned cursors to show ten records per page and a partial final page", async () => {
    const pages = new Map<string | undefined, RemotePipelinesPage>([
      [undefined, createPage(1, 10, "page-two")],
      ["page-two", createPage(11, 10, "page-three")],
      ["page-three", createPage(21, 5, null)],
    ]);
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      const page = pages.get(pageToken);
      if (!page) throw new Error(`Unexpected page token: ${pageToken}`);
      return page;
    });
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    await screen.findByText("Pipeline 1");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Remote Pipelines" });
    const rows = () => within(table).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(10);
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      1,
      backend.backendUrl,
      undefined,
      undefined,
    );
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 1")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(10);
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      2,
      backend.backendUrl,
      "page-two",
      undefined,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 21");
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      3,
      backend.backendUrl,
      "page-three",
      undefined,
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    });
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      "page-two",
      undefined,
    );

    await user.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Pipeline 1");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await waitFor(() => {
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        undefined,
      );
    });
  });

  it("ignores a legacy page number when deciding which tab to open", async () => {
    await renderDashboard(`${APP_ROUTES.DASHBOARD_PIPELINES}?page=1000000`);

    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
    expect(listRemotePipelines).not.toHaveBeenCalled();
  });

  it.each(["2", "1000000", "0", "-2", "1.5", "invalid", "9007199254740992"])(
    "ignores legacy page value %s without walking prior cursors",
    async (page) => {
      vi.mocked(listRemotePipelines).mockResolvedValue(
        createPage(1, 10, "page-two"),
      );
      const { searchParams } = await renderDashboard(
        `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote&page=${page}&panel=compact`,
      );

      expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
      expect(screen.getByText("Page 1")).toBeInTheDocument();
      expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
        backend.backendUrl,
        undefined,
        undefined,
      );
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
      expect(searchParams().get("tab")).toBe("remote");
      expect(searchParams().get("panel")).toBe("compact");
    },
  );

  it("opens a copied listing URL on the first page", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) =>
      pageToken ? createPage(11, 5, null) : createPage(1, 10, "page-two"),
    );
    const { user, router, unmount } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    const sharedUrl = router.history.location.href;
    unmount();
    vi.mocked(listRemotePipelines).mockClear();

    await renderDashboard(sharedUrl);

    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
      backend.backendUrl,
      undefined,
      undefined,
    );
  });

  it("follows refreshed cursors after returning to First", async () => {
    let refreshed = false;
    const pages = new Map<string, RemotePipelinesPage>([
      ["old-page-two", createPage(11, 10, "old-page-three")],
      ["old-page-three", createPage(21, 5, null)],
      ["new-page-two", createPage(111, 10, "new-page-three")],
      ["new-page-three", createPage(121, 5, null)],
    ]);
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      if (!pageToken) {
        return refreshed
          ? createPage(101, 10, "new-page-two")
          : createPage(1, 10, "old-page-two");
      }
      const result = pages.get(pageToken);
      if (!result) throw new Error(`Unexpected page token: ${pageToken}`);
      return result;
    });
    const { user } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    refreshed = true;

    await user.click(screen.getByRole("button", { name: "First page" }));
    await screen.findByText("Pipeline 101");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 111");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Pipeline 121")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(
      vi.mocked(listRemotePipelines).mock.calls.map(([, token]) => token),
    ).toEqual([
      undefined,
      "old-page-two",
      undefined,
      "new-page-two",
      "new-page-three",
    ]);
  });

  it("keeps pagination out of the URL and browser history without replacing the table", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      if (pageToken === "page-three") return createPage(21, 5, null);
      if (pageToken === "page-two") return createPage(11, 10, "page-three");
      return createPage(1, 10, "page-two");
    });
    const { user, router, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?panel=compact`,
    );
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    const table = screen.getByRole("table", { name: "Remote Pipelines" });
    const initialUrl = router.history.location.href;
    const historyLength = router.history.length;
    expect(searchParams().get("tab")).toBe("remote");
    vi.mocked(window.scrollTo).mockClear();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(router.history.location.href).toBe(initialUrl);
    expect(router.history.length).toBe(historyLength);
    expect(screen.getByRole("table", { name: "Remote Pipelines" })).toBe(table);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 21");
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(router.history.location.href).toBe(initialUrl);
    expect(router.history.length).toBe(historyLength);
    expect(
      vi.mocked(listRemotePipelines).mock.calls.map(([, token]) => token),
    ).toEqual([undefined, "page-two", "page-three"]);

    await user.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Pipeline 11");
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(router.history.location.href).toBe(initialUrl);
    expect(router.history.length).toBe(historyLength);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "First page" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "First page" }));
    await screen.findByText("Pipeline 1");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(router.history.location.href).toBe(initialUrl);
    expect(router.history.length).toBe(historyLength);
    expect(searchParams().has("page")).toBe(false);
    expect(searchParams().get("panel")).toBe("compact");
    expect(screen.getByRole("table", { name: "Remote Pipelines" })).toBe(table);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("restores tabs through browser Back and Forward with fresh cursor history", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) =>
      pageToken ? createPage(11, 10, null) : createPage(1, 10, "page-two"),
    );
    const { user, router, searchParams } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    await user.click(screen.getByRole("tab", { name: "Local Pipelines" }));
    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();

    await act(async () => {
      router.history.back();
    });
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(searchParams().get("tab")).toBe("remote");
    expect(searchParams().has("page")).toBe(false);

    await act(async () => {
      router.history.back();
    });
    expect(await screen.findByText("Local pipeline list")).toBeInTheDocument();

    await act(async () => {
      router.history.forward();
    });
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();

    await act(async () => {
      router.history.forward();
    });
    expect(await screen.findByText("Local pipeline list")).toBeInTheDocument();
    expect(searchParams().get("tab")).toBe("local");
  });

  it("returns to the first page with the First page button", async () => {
    const pages = new Map<string | undefined, RemotePipelinesPage>([
      [undefined, createPage(1, 10, "page-two")],
      ["page-two", createPage(11, 10, "page-three")],
      ["page-three", createPage(21, 5, null)],
    ]);
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      const page = pages.get(pageToken);
      if (!page) throw new Error(`Unexpected page token: ${pageToken}`);
      return page;
    });
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 21");
    expect(screen.getByText("Page 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "First page" }));
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      undefined,
      undefined,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      "page-two",
      undefined,
    );
  });

  it("disables navigation until the next page request settles", async () => {
    let resolveNextPage: ((page: RemotePipelinesPage) => void) | undefined;
    const nextPage = new Promise<RemotePipelinesPage>((resolve) => {
      resolveNextPage = resolve;
    });
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage(1, 10, "page-two"))
      .mockReturnValueOnce(nextPage);
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByText("Loading pipelines…")).not.toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByText("Pipeline 1")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Remote Pipelines" }),
    ).toHaveAttribute("aria-busy", "true");
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
      resolveNextPage(createPage(11, 10, null));
    });
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps recovery controls when the pipeline count shrinks on a later page", async () => {
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage(1, 10, "page-two"))
      .mockResolvedValueOnce(createPage(11, 0, null))
      .mockResolvedValueOnce(createPage(1, 8, null));
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("No pipelines found.")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
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
    expect(screen.queryByText("No pipelines found.")).not.toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenNthCalledWith(
      3,
      backend.backendUrl,
      undefined,
      undefined,
    );
  });

  it("allows returning to the previous page after a next page request fails", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
      if (pageToken) throw new Error("Request failed");
      return createPage(1, 10, "page-two");
    });
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByText("Failed to load pipelines."),
    ).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(
      screen.queryByText("Failed to load pipelines."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables every page control when the backend becomes unavailable", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) =>
      pageToken
        ? createPage(11, 10, "page-three")
        : createPage(1, 10, "page-two"),
    );
    const { user, rerender } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");

    backend = { ...backend, available: false };
    rerender();

    expect(screen.getByText("Pipelines are unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
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
        if (url !== originalBackendUrl) return createPage(101, 1, null);
        return pageToken
          ? createPage(11, 10, null)
          : createPage(1, 10, "original-page-two");
      },
    );
    const { user, rerender } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");

    backend = { ...backend, backendUrl: "https://other.example.com" };
    rerender();

    expect(await screen.findByText("Pipeline 101")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 11")).not.toBeInTheDocument();
    expectNoPaginationControls();
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      undefined,
      undefined,
    );
    expect(listRemotePipelines).not.toHaveBeenCalledWith(
      backend.backendUrl,
      "original-page-two",
      undefined,
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
