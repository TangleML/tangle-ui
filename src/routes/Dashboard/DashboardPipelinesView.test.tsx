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

import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";
import {
  deleteRemotePipeline,
  listRemotePipelines,
  type RemotePipeline,
  type RemotePipelinesPage,
} from "@/services/remotePipelinesService";
import { formatDate } from "@/utils/date";

import { DashboardPipelinesView } from "./DashboardPipelinesView";
import { getRemotePipelinesFilterQuery } from "./pipelinesSearch";

vi.mock("@/components/Home/PipelineSection/PipelineSection", () => ({
  PipelineSection: () => <div>Local pipeline list</div>,
}));

vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useLocalPipelineNames: () => ({
    data: ["Local pipeline"],
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("./FavoritesPreview", () => ({
  FavoritesPreview: () => <div>Favorite Pipelines</div>,
}));

vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/useRecentlyViewed", () => ({
  removeRecentlyViewed: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/services/remotePipelineEditorService", () => ({
  getRemotePipelineWriter: vi.fn(),
}));

type Backend = ReturnType<typeof useBackend>;

function createBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
    ready: true,
    isConfiguredFromEnv: false,
    isConfiguredFromRelativePath: false,
    setEnvConfig: vi.fn(),
    setRelativePathConfig: vi.fn(),
    setBackendUrl: vi.fn(),
    ping: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const backend = createBackend();
const BackendContext = createContext<Backend>(backend);

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: (): Backend => useContext(BackendContext),
}));

vi.mock("@/services/remotePipelinesService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/remotePipelinesService")
  >()),
  deleteRemotePipeline: vi.fn(),
  listRemotePipelines: vi.fn(),
}));

const pipeline: RemotePipeline = {
  id: "pipeline-1",
  user_id: "user@example.com",
  pipeline_name: "Example pipeline",
  created_at: "2026-09-22T17:26:29Z",
  updated_at: "2026-09-23T17:26:29Z",
  current_version: "version-1",
  file_path: "Example pipeline",
  versioning_mode: "full",
};
const meFilterQuery = getRemotePipelinesFilterQuery({ user: "me" });

const clients: QueryClient[] = [];

function createDeferredPage() {
  return Promise.withResolvers<RemotePipelinesPage>();
}

function flushQueryNotifications() {
  return act(() => vi.advanceTimersByTimeAsync(0));
}

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

function mockCursorPages(entries: [string | undefined, RemotePipelinesPage][]) {
  const pages = new Map(entries);
  vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) => {
    const page = pages.get(pageToken);
    if (!page) throw new Error(`Unexpected page token: ${pageToken}`);
    return page;
  });
}

function expectNoPaginationControls() {
  expect(
    screen.queryByRole("navigation", { name: "Remote pipelines pagination" }),
  ).not.toBeInTheDocument();
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
  initialBackend: Backend = createBackend(),
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  let currentBackend = initialBackend;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <BackendContext.Provider value={currentBackend}>
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
  const editorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.PIPELINE_EDITOR,
    component: () => <div>Editor destination</div>,
  });

  const remoteEditorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
    component: () => <div>Remote editor destination</div>,
  });

  const history = createMemoryHistory({ initialEntries: [initialEntry] });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      pipelinesRoute,
      editorRoute,
      remoteEditorRoute,
    ]),
    history,
    scrollRestoration: true,
  });
  await router.load();
  const rendered = render(<RouterProvider router={router} />, { wrapper });
  return {
    ...rendered,
    setBackend(next: Backend) {
      currentBackend = next;
      rendered.rerender(<RouterProvider router={router} />);
    },
    client,
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
    new DOMRect(0, 0, 1080, 0),
  );
  const actionsHeader = within(table).getByRole("columnheader", {
    name: "Actions",
  });
  vi.spyOn(actionsHeader, "getBoundingClientRect").mockReturnValue(
    new DOMRect(1000, 0, 80, 0),
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
      .filter((header) => header !== actionsHeader)
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
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(getRemotePipelineWriter).mockResolvedValue(pipeline.user_id);
  vi.mocked(deleteRemotePipeline).mockResolvedValue(undefined);
  vi.mocked(listRemotePipelines).mockResolvedValue({
    pipelines: [pipeline],
    nextPageToken: null,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("DashboardPipelinesView remote pipelines", () => {
  it("blocks row and name navigation during deletion and restores them after failure", async () => {
    const deletion = Promise.withResolvers<void>();
    vi.mocked(deleteRemotePipeline).mockReturnValue(deletion.promise);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { user, router } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    const row = await screen.findByRole("row", { name: /Example pipeline/ });
    const link = within(row).getByRole("link", { name: "Example pipeline" });
    const ownerCell = within(row).getByRole("cell", { name: pipeline.user_id });
    await user.click(
      await within(row).findByRole("button", { name: /^Delete / }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(link).toHaveAttribute("aria-disabled", "true"));

    await user.click(ownerCell);
    await user.click(link);
    fireEvent.click(ownerCell, { metaKey: true });
    expect(open).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe(APP_ROUTES.DASHBOARD_PIPELINES);
    expect(
      screen.queryByText("Remote editor destination"),
    ).not.toBeInTheDocument();

    await act(async () => deletion.reject(new Error("Delete failed")));
    await waitFor(() =>
      expect(link).not.toHaveAttribute("aria-disabled", "true"),
    );
    expect(link).toHaveAttribute("href", "/editor/pipeline/pipeline-1");
    await user.click(ownerCell);
    await screen.findByText("Remote editor destination");
    expect(router.state.location.pathname).toBe("/editor/pipeline/pipeline-1");
  });

  it("keeps page two and restores focus when deletion leaves another row", async () => {
    let deleted = false;
    vi.mocked(listRemotePipelines).mockImplementation(async (_, token) =>
      token
        ? createPage(deleted ? 12 : 11, deleted ? 1 : 2, null)
        : createPage(1, 10, "page-2"),
    );
    vi.mocked(deleteRemotePipeline).mockImplementation(async () => {
      deleted = true;
    });
    const { user } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    await user.click(
      await screen.findByRole("button", { name: "Delete Pipeline 11" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByText("Pipeline 11")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Pipeline 12")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("table", { name: "Remote Pipelines" }),
      ).toHaveFocus(),
    );
  });

  it("keeps focus on a control selected while the deleted list refreshes", async () => {
    const refreshed = createDeferredPage();
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage(1, 2, null))
      .mockReturnValue(refreshed.promise);
    const { user, client } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    await user.click(
      await screen.findByRole("button", { name: "Delete Pipeline 1" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(listRemotePipelines).toHaveBeenCalledTimes(2));
    const filter = screen.getByRole("textbox", { name: "Search by name" });
    await user.click(filter);

    await act(async () => refreshed.resolve(createPage(2, 1, null)));

    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(filter).toHaveFocus();
  });

  it("returns to the previous page after deleting the final row without opening the editor", async () => {
    let deleted = false;
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) =>
      pageToken
        ? createPage(11, deleted ? 0 : 1, null)
        : createPage(1, 10, deleted ? null : "page-2"),
    );
    vi.mocked(deleteRemotePipeline).mockImplementation(async () => {
      deleted = true;
    });
    const { user, router, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote&panel=compact`,
    );
    await screen.findByRole("link", { name: "Pipeline 1" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    const row = await screen.findByRole("row", { name: /Pipeline 11/ });
    await user.click(
      await within(row).findByRole("button", { name: /^Delete / }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await screen.findByRole("link", { name: "Pipeline 1" });
    expect(searchParams().has("page")).toBe(false);
    expect(
      screen.queryByRole("link", { name: "Pipeline 11" }),
    ).not.toBeInTheDocument();
    expect(searchParams().get("panel")).toBe("compact");
    expect(router.state.location.pathname).toBe(APP_ROUTES.DASHBOARD_PIPELINES);
    expectNoPaginationControls();
  });

  it.each(["filters", "backend"])(
    "keeps the new page when deletion finishes after changing %s",
    async (changed) => {
      const deletedPage = createDeferredPage();
      let deleted = false;
      vi.mocked(listRemotePipelines).mockImplementation(
        async (url, token, query) => {
          if (url !== backend.backendUrl || query !== meFilterQuery) {
            return token
              ? createPage(211, 5, null)
              : createPage(201, 10, "new-page-two");
          }
          if (!token) return createPage(1, 10, "original-page-two");
          return deleted ? deletedPage.promise : createPage(11, 1, null);
        },
      );
      vi.mocked(deleteRemotePipeline).mockImplementation(async () => {
        deleted = true;
      });
      const { user, router, setBackend, client } = await renderDashboard(
        `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
      );
      await screen.findByText("Pipeline 1");
      await user.click(screen.getByRole("button", { name: "Next" }));
      const row = await screen.findByRole("row", { name: /Pipeline 11/ });
      await user.click(
        await within(row).findByRole("button", { name: /^Delete / }),
      );
      await user.click(screen.getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(listRemotePipelines).toHaveBeenCalledTimes(3));

      if (changed === "backend") {
        setBackend(createBackend({ backendUrl: "https://other.example.com" }));
      } else {
        await act(async () => {
          await router.navigate({
            to: APP_ROUTES.DASHBOARD_PIPELINES,
            search: { tab: "remote", name: "new" },
          });
        });
      }
      await screen.findByText("Pipeline 201");
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Pipeline 211");

      await act(async () => deletedPage.resolve(createPage(11, 0, null)));
      await waitFor(() => expect(client.isMutating()).toBe(0));
      expect(screen.getByText("Pipeline 211")).toBeInTheDocument();
      expect(screen.getByText("Page 2")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    },
  );

  it("opens remote pipeline names and rows in the editor", async () => {
    const editorPath = "/editor/pipeline/pipeline-1";
    const { user, router, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    const nameLink = await screen.findByRole("link", {
      name: "Example pipeline",
    });
    expect(nameLink).toHaveAttribute("href", editorPath);

    await user.click(nameLink);
    await screen.findByText("Remote editor destination");
    expect(router.state.location.pathname).toBe(editorPath);
    expect(searchParams().get("source")).toBeNull();

    await act(async () => {
      await router.navigate({
        to: APP_ROUTES.DASHBOARD_PIPELINES,
        search: { tab: "remote" },
      });
    });
    const row = await screen.findByRole("row", {
      name: /Example pipeline/,
    });
    await user.click(within(row).getByRole("cell", { name: pipeline.user_id }));
    await screen.findByText("Remote editor destination");
    expect(router.state.location.pathname).toBe(editorPath);
    expect(searchParams().get("source")).toBeNull();
  });

  it("copies the full ID from its text and keyboard button without opening the editor", async () => {
    const { user, router, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const row = await screen.findByRole("row", { name: /Example pipeline/ });

    await user.click(within(row).getByText(pipeline.id));
    const copyButton = within(row).getByRole("button", {
      name: "Copy pipeline ID",
    });
    copyButton.focus();
    await user.keyboard("{Enter}");

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenNthCalledWith(1, pipeline.id);
    expect(writeText).toHaveBeenNthCalledWith(2, pipeline.id);
    expect(router.state.location.pathname).toBe(APP_ROUTES.DASHBOARD_PIPELINES);
    expect(searchParams().get("tab")).toBe("remote");
    expect(screen.queryByText(/editor destination/i)).not.toBeInTheDocument();
  });

  it.each(["metaKey", "ctrlKey"] as const)(
    "opens a remote pipeline in a new tab on a %s row click",
    async (modifier) => {
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      const { router } = await renderDashboard(
        `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
      );
      const row = await screen.findByRole("row", { name: /Example pipeline/ });

      await act(async () => {
        fireEvent.click(
          within(row).getByRole("cell", { name: pipeline.user_id }),
          {
            [modifier]: true,
          },
        );
      });

      expect(open).toHaveBeenCalledOnce();
      const [href, target] = open.mock.calls[0];
      const openedUrl = new URL(String(href), "http://localhost");
      expect(openedUrl.pathname).toBe("/editor/pipeline/pipeline-1");
      expect(openedUrl.searchParams.get("source")).toBeNull();
      expect(target).toBe("_blank");
      expect(router.state.location.pathname).toBe(
        APP_ROUTES.DASHBOARD_PIPELINES,
      );
    },
  );

  it("preserves a deployment's hash prefix when opening a remote pipeline in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { router } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    const row = await screen.findByRole("row", { name: /Example pipeline/ });
    vi.spyOn(router.history, "createHref").mockImplementation(
      (href) => `/tangle-ui/#${href}`,
    );

    await act(async () => {
      fireEvent.click(
        within(row).getByRole("cell", { name: pipeline.user_id }),
        { metaKey: true },
      );
    });

    expect(open).toHaveBeenCalledExactlyOnceWith(
      "/tangle-ui/#/editor/pipeline/pipeline-1",
      "_blank",
      "noopener,noreferrer",
    );
    expect(router.state.location.pathname).toBe(APP_ROUTES.DASHBOARD_PIPELINES);
  });

  it("opens remote pipelines by default with the current-user filter and metadata", async () => {
    const { user } = await renderDashboard();

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Remote Pipelines",
      "Local Pipelines",
    ]);
    expect(
      screen.getByRole("tab", { name: "Remote Pipelines" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Search by user" })).toHaveValue(
      "me",
    );
    expect(
      screen.getByRole("link", { name: "Example Pipelines" }),
    ).toHaveAttribute("href", APP_ROUTES.LEARN_EXAMPLES);
    const row = await screen.findByRole("row", { name: /Example pipeline/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "Example pipeline",
      "pipeline-1",
      "user@example.com",
      formatDate(pipeline.created_at),
      formatDate(pipeline.updated_at),
      "version-1",
      "",
    ]);
    expect(within(cells[0]).queryByRole("button")).not.toBeInTheDocument();
    expect(
      within(cells[6]).getByRole("button", {
        name: "Add Example pipeline to favorites",
      }),
    ).toBeInTheDocument();
    expect(
      await within(cells[6]).findByRole("button", { name: /^Delete / }),
    ).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
      backend.backendUrl,
      undefined,
      meFilterQuery,
    );
    expectNoPaginationControls();
    expect(
      screen.getByRole("link", { name: "Example Pipelines" }),
    ).toHaveAttribute("href", APP_ROUTES.LEARN_EXAMPLES);
    expect(screen.getByText("Favorite Pipelines")).toBeInTheDocument();
    expect(screen.queryByText("Local pipeline list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Local Pipelines" }));
    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
  });

  it("round-trips text filters through a shared URL", async () => {
    const { user, router, searchParams, unmount } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote&panel=compact`,
    );
    await screen.findByText("Example pipeline");
    const fields = [
      ["name", "Search by name", ' Different & "pipeline" + # % /? '],
      ["id", "Search by ID", "123e4567-e89b-12d3-a456-426614174000"],
      ["user", "Search by user", "another@example.com"],
    ];
    for (const [, label, value] of fields) {
      await user.clear(screen.getByRole("textbox", { name: label }));
      await user.type(screen.getByRole("textbox", { name: label }), value);
    }
    await waitFor(() => {
      for (const [key, , value] of fields)
        expect(searchParams().get(key)).toBe(value);
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        expect.stringContaining('"value":"another@example.com"'),
      );
    });
    const sharedUrl = router.history.location.href;
    const expectedQuery = vi.mocked(listRemotePipelines).mock.lastCall?.[2];
    expect(router.history.length).toBe(1);
    expect(searchParams().get("panel")).toBe("compact");
    unmount();
    vi.mocked(listRemotePipelines).mockClear();

    await renderDashboard(sharedUrl);
    await screen.findByText("Example pipeline");
    for (const [, label, value] of fields) {
      expect(screen.getByRole("textbox", { name: label })).toHaveValue(value);
    }
    expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
      backend.backendUrl,
      undefined,
      expectedQuery,
    );
  });

  it("applies Me immediately and clears every filter", async () => {
    const { user, router, searchParams, unmount } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?name=shared&user=another@example.com&id=123e4567-e89b-12d3-a456-426614174000&createdFrom=2026-09-10&createdTo=2026-09-12&updatedFrom=2026-09-20&updatedTo=2026-09-22&panel=compact`,
    );
    await screen.findByText("Example pipeline");
    await user.click(screen.getByRole("button", { name: "Clear user filter" }));
    expect(searchParams().get("user")).toBe("");
    await user.click(screen.getByRole("button", { name: "Me" }));
    expect(screen.getByRole("textbox", { name: "Search by user" })).toHaveValue(
      "me",
    );
    expect(searchParams().get("user")).toBe("me");

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    for (const input of screen.getAllByRole("textbox"))
      expect(input).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Created at" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Updated at" }),
    ).toBeInTheDocument();
    expect(Object.fromEntries(searchParams())).toEqual({
      tab: "remote",
      panel: "compact",
      user: "",
    });
    await waitFor(() =>
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        undefined,
      ),
    );
    const clearedUrl = router.history.location.href;
    unmount();
    await renderDashboard(clearedUrl);
    expect(screen.getByRole("textbox", { name: "Search by user" })).toHaveValue(
      "",
    );
  });

  it.each([
    ["Created at", "created"],
    ["Updated at", "updated"],
  ])("selects and restores the %s date range", async (field, prefix) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 12));
    const { user, router, searchParams, unmount } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    await screen.findByText("Example pipeline");
    const group = within(screen.getByRole("group", { name: field }));
    await user.click(group.getByRole("button"));
    const calendar = within(screen.getByRole("dialog"));
    await user.click(
      calendar.getByRole("button", { name: "Go to the Previous Month" }),
    );
    for (const day of [10, 12]) {
      await user.click(
        calendar.getByRole("button", {
          name: format(new Date(2026, 8, day), "PPPP"),
        }),
      );
    }
    await user.keyboard("{Escape}");
    expect(group.getByRole("button")).toHaveTextContent(
      "Sep 10, 2026 – Sep 12, 2026",
    );
    expect(searchParams().get(`${prefix}From`)).toBe("2026-09-10");
    expect(searchParams().get(`${prefix}To`)).toBe("2026-09-12");
    const sharedUrl = router.history.location.href;
    unmount();

    await renderDashboard(sharedUrl);
    expect(
      within(screen.getByRole("group", { name: field })).getByRole("button"),
    ).toHaveTextContent("Sep 10, 2026 – Sep 12, 2026");
  });

  it("ignores a legacy page number in a filtered link without requesting unfiltered results", async () => {
    const query = getRemotePipelinesFilterQuery({ name: "shared", user: "me" });
    vi.mocked(listRemotePipelines).mockImplementation(async (_, token) =>
      token ? createPage(111, 5, null) : createPage(101, 10, "shared-two"),
    );
    const { searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?name=shared&page=1000000&panel=compact`,
    );

    expect(await screen.findByText("Pipeline 101")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Remote Pipelines" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Search by name" })).toHaveValue(
      "shared",
    );
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(searchParams().get("panel")).toBe("compact");
    expect(vi.mocked(listRemotePipelines).mock.calls).toEqual([
      [backend.backendUrl, undefined, query],
    ]);
  });

  it("keeps an explicit local tab when a link contains remote filters", async () => {
    const { user } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=local&name=shared`,
    );
    expect(screen.getByText("Local pipeline list")).toBeInTheDocument();
    expect(listRemotePipelines).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Example pipeline");
    expect(screen.getByRole("textbox", { name: "Search by name" })).toHaveValue(
      "shared",
    );
    expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
      backend.backendUrl,
      undefined,
      expect.stringContaining('"value_substring":"shared"'),
    );
  });

  it("restores an invalid ID link without sending a search request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?id=not-a-uuid&name=shared`,
    );
    const idInput = screen.getByRole("textbox", { name: "Search by ID" });
    expect(idInput).toHaveValue("not-a-uuid");
    expect(idInput).toHaveAttribute("aria-invalid", "true");
    expect(idInput).toHaveAccessibleDescription(
      "Enter a complete pipeline ID (UUID) to search.",
    );
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(listRemotePipelines).not.toHaveBeenCalled();
    expect(
      screen.getByText("Enter a complete pipeline ID to search."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No pipelines found.")).not.toBeInTheDocument();
  });

  it.each([
    ["name", "Search by name", "shared"],
    ["id", "Search by ID", "123e4567-e89b-12d3-a456-426614174000"],
    ["user", "Search by user", "reader@example.com"],
  ])(
    "keeps the caret when editing the middle of the %s filter",
    async (key, label, value) => {
      const { user, searchParams } = await renderDashboard(
        `${APP_ROUTES.DASHBOARD_PIPELINES}?${key}=${value}`,
      );
      await screen.findByText("Example pipeline");
      const input = screen.getByRole("textbox", { name: label });

      await user.type(input, "XY", {
        initialSelectionStart: 2,
        initialSelectionEnd: 2,
      });
      const edited = `${value.slice(0, 2)}XY${value.slice(2)}`;
      expect(input).toHaveValue(edited);
      expect(input).toHaveFocus();
      expect(searchParams().get(key)).toBe(value);
      await waitFor(() => expect(searchParams().get(key)).toBe(edited));
      await user.keyboard("Z");
      expect(input).toHaveValue(`${value.slice(0, 2)}XYZ${value.slice(2)}`);
    },
  );

  it("restores an external replacement while a search input is focused", async () => {
    const { user, router, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?name=initial`,
    );
    await screen.findByText("Example pipeline");
    const input = screen.getByRole("textbox", { name: "Search by name" });
    await user.click(input);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(input, { target: { value: "discarded" } });
    await act(async () => {
      await router.navigate({
        to: APP_ROUTES.DASHBOARD_PIPELINES,
        search: { name: "external" },
        replace: true,
      });
    });
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(input).toHaveValue("external");
    expect(input).toHaveFocus();
    expect(searchParams().get("name")).toBe("external");
    expect(
      vi
        .mocked(listRemotePipelines)
        .mock.calls.some(([, , query]) => query?.includes("discarded")),
    ).toBe(false);
  });

  it.each(["Clear all filters", "Clear user filter"])(
    "cancels an uncommitted user draft with %s",
    async (label) => {
      const { searchParams } = await renderDashboard(
        `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
      );
      await screen.findByText("Example pipeline");
      const input = screen.getByRole("textbox", { name: "Search by user" });
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      fireEvent.change(input, { target: { value: "discarded@example.com" } });
      await act(() => vi.advanceTimersByTimeAsync(199));
      expect(searchParams().has("user")).toBe(false);
      expect(listRemotePipelines).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: label }));
      await act(() => vi.advanceTimersByTimeAsync(250));
      expect(input).toHaveValue("");
      expect(searchParams().get("user")).toBe("");
      expect(
        vi.mocked(listRemotePipelines).mock.calls.map(([, , query]) => query),
      ).toEqual([meFilterQuery, undefined]);
    },
  );

  it("pauses a successful search when the ID becomes incomplete", async () => {
    const { searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
    );
    await screen.findByText("Example pipeline");
    const input = screen.getByRole("textbox", { name: "Search by ID" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(input, { target: { value: "123e4567-e89b" } });
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Enter a complete pipeline ID (UUID) to search.",
    );
    expect(
      screen.getByText("Enter a complete pipeline ID to search."),
    ).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenCalledTimes(1);
    expect(searchParams().get("id")).toBe("123e4567-e89b");
    expect(screen.queryByText("No pipelines found.")).not.toBeInTheDocument();
  });

  it("debounces searches and preserves the table while resetting pagination", async () => {
    const filteredPage = createDeferredPage();
    vi.mocked(listRemotePipelines).mockImplementation(
      async (_, token, query) => {
        if (query !== meFilterQuery) return filteredPage.promise;
        return token
          ? createPage(11, 10, "unfiltered-three")
          : createPage(1, 10, "unfiltered-two");
      },
    );
    const { user, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote&panel=compact`,
    );
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");
    const table = screen.getByRole("table", { name: "Remote Pipelines" });
    const input = screen.getByRole("textbox", { name: "Search by name" });
    fireEvent.keyDown(
      within(table).getByRole("separator", { name: "Resize User column" }),
      { key: "ArrowRight" },
    );
    const widths = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.style.width);
    const requestsBeforeSearch =
      vi.mocked(listRemotePipelines).mock.calls.length;
    vi.mocked(window.scrollTo).mockClear();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(input, { target: { value: "match" } });
    await act(() => vi.advanceTimersByTimeAsync(199));
    expect(input).toHaveValue("match");
    expect(searchParams().get("name")).toBeNull();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(searchParams().has("page")).toBe(false);
    for (const button of within(
      screen.getByRole("navigation", { name: "Remote pipelines pagination" }),
    ).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(listRemotePipelines).toHaveBeenCalledTimes(requestsBeforeSearch);
    await act(() => vi.advanceTimersByTimeAsync(1));
    vi.useRealTimers();

    await waitFor(() => {
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        expect.stringContaining('"value_substring":"match"'),
      );
      expect(searchParams().has("page")).toBe(false);
    });
    expect(listRemotePipelines).toHaveBeenCalledTimes(requestsBeforeSearch + 1);
    expect(searchParams().get("panel")).toBe("compact");
    expect(screen.getByRole("table", { name: "Remote Pipelines" })).toBe(table);
    expect(screen.getByText("Pipeline 11")).toBeInTheDocument();
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.style.width),
    ).toEqual(widths);
    expect(window.scrollTo).not.toHaveBeenCalled();

    await act(async () => filteredPage.resolve(createPage(101, 5, null)));
    expect(await screen.findByText("Pipeline 101")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Remote Pipelines" })).toBe(table);
  });

  it("preserves filters on Next and returns to the first page on Clear", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(
      async (_, token, query) => {
        if (!query) return createPage(1, 10, "unfiltered-two");
        return token
          ? createPage(111, 5, null)
          : createPage(101, 10, "filtered-two");
      },
    );
    const { user, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?name=match`,
    );
    await screen.findByText("Pipeline 101");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pipeline 111")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(searchParams().get("name")).toBe("match");

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(searchParams().has("page")).toBe(false);
    expect(searchParams().has("name")).toBe(false);
    expect(screen.getByRole("textbox", { name: "Search by name" })).toHaveValue(
      "",
    );
  });

  it("keeps the newest search results when an older response arrives later", async () => {
    const olderPage = createDeferredPage();
    vi.mocked(listRemotePipelines).mockImplementation(
      async (_, _pageToken, query) => {
        if (query?.includes("older")) return olderPage.promise;
        return query?.includes("newer")
          ? createPage(201, 1, null)
          : createPage(1, 1, null);
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

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => {
      olderPage.resolve(createPage(101, 1, null));
    });
    await flushQueryNotifications();
    vi.useRealTimers();
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

    expect(
      await screen.findByRole("cell", { name: "No pipelines found." }),
    ).toHaveAttribute("colspan", "7");
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
    [{ configured: false }, "Local pipeline list"],
    [{ available: false }, "Pipelines are unavailable."],
  ])("does not fetch when the backend state is %o", async (state, message) => {
    await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote`,
      createBackend(state),
    );

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

  it("navigates cursor pages without totals, including a partial final page", async () => {
    mockCursorPages([
      [undefined, createPage(1, 10, "page-two")],
      ["page-two", createPage(11, 10, "page-three")],
      ["page-three", createPage(21, 5, null)],
    ]);
    const { user } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));

    await screen.findByText("Pipeline 1");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Remote Pipelines" });
    const rows = () => within(table).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(10);
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 1")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 21");
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Pipeline 1");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("ignores a legacy page number when deciding which tab to open", async () => {
    await renderDashboard(`${APP_ROUTES.DASHBOARD_PIPELINES}?page=1000000`);

    expect(await screen.findByText("Example pipeline")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Remote Pipelines" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("ignores a legacy page value without walking prior cursors", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue(
      createPage(1, 10, "page-two"),
    );
    const { searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=remote&page=1000000&panel=compact`,
    );

    expect(await screen.findByText("Pipeline 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
      backend.backendUrl,
      undefined,
      meFilterQuery,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(searchParams().get("tab")).toBe("remote");
    expect(searchParams().get("panel")).toBe("compact");
  });

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
      meFilterQuery,
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
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 21");
    refreshed = true;

    await user.click(screen.getByRole("button", { name: "First page" }));
    await screen.findByText("Pipeline 101");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 111");
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Pipeline 121")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(
      vi.mocked(listRemotePipelines).mock.calls.map(([, token]) => token),
    ).toEqual([
      undefined,
      "old-page-two",
      "old-page-three",
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
    expect(searchParams().has("tab")).toBe(false);
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
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
    );
  });

  it("restores tabs through browser Back and Forward with fresh cursor history", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(async (_, pageToken) =>
      pageToken ? createPage(11, 10, null) : createPage(1, 10, "page-two"),
    );
    const { user, router, searchParams } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?tab=local`,
    );
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

  it("restores filters at the first page through history and cancels a pending search on Back", async () => {
    vi.mocked(listRemotePipelines).mockImplementation(
      async (_, token, query) => {
        const start = query?.includes('"first"') ? 101 : 201;
        return token
          ? createPage(start + 10, 5, null)
          : createPage(start, 10, `page-two-${start}`);
      },
    );
    const { router, searchParams, user } = await renderDashboard(
      `${APP_ROUTES.DASHBOARD_PIPELINES}?name=first&panel=compact`,
    );
    await screen.findByText("Pipeline 101");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 111");
    const nameInput = screen.getByRole("textbox", { name: "Search by name" });
    await act(async () => {
      await router.navigate({
        to: APP_ROUTES.DASHBOARD_PIPELINES,
        search: { tab: "remote", name: "second", panel: "compact" },
        resetScroll: false,
      });
    });
    await screen.findByText("Pipeline 201");
    expect(nameInput).toHaveValue("second");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(searchParams().has("page")).toBe(false);
    expect(listRemotePipelines).not.toHaveBeenCalledWith(
      backend.backendUrl,
      "page-two-101",
      expect.stringContaining('"value_substring":"second"'),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 211");

    await act(async () => {
      router.history.back();
    });
    await screen.findByText("Pipeline 101");
    expect(nameInput).toHaveValue("first");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    await act(async () => {
      router.history.forward();
    });
    await screen.findByText("Pipeline 201");
    expect(nameInput).toHaveValue("second");
    expect(screen.getByText("Page 1")).toBeInTheDocument();

    await user.click(nameInput);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "pending" } });
    });
    expect(searchParams().get("name")).toBe("second");
    expect(searchParams().has("page")).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(100));
    await act(async () => {
      router.history.back();
    });
    await act(() => vi.advanceTimersByTimeAsync(250));

    expect(nameInput).toHaveValue("first");
    expect(nameInput).toHaveFocus();
    expect(searchParams().get("name")).toBe("first");
    expect(searchParams().has("page")).toBe(false);
    expect(screen.getByText("Pipeline 101")).toBeInTheDocument();
    expect(
      vi
        .mocked(listRemotePipelines)
        .mock.calls.some(([, , query]) => query?.includes('"pending"')),
    ).toBe(false);

    await act(async () => {
      router.history.forward();
    });
    await act(() => vi.advanceTimersByTimeAsync(250));
    await flushQueryNotifications();
    vi.useRealTimers();
    expect(nameInput).toHaveValue("second");
    expect(nameInput).toHaveFocus();
    expect(searchParams().has("page")).toBe(false);
    expect(searchParams().get("panel")).toBe("compact");
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      backend.backendUrl,
      undefined,
      expect.stringContaining('"value_substring":"second"'),
    );
    expect(await screen.findByText("Pipeline 201")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("disables navigation until the next page request settles", async () => {
    const nextPage = createDeferredPage();
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage(1, 10, "page-two"))
      .mockReturnValueOnce(nextPage.promise);
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
      nextPage.resolve(createPage(11, 10, null));
    });
    expect(await screen.findByText("Pipeline 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps recovery controls when a later page becomes empty", async () => {
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
    const { user, setBackend } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");

    setBackend(createBackend({ available: false }));

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
    const { user, setBackend } = await renderDashboard();
    await user.click(screen.getByRole("tab", { name: "Remote Pipelines" }));
    await screen.findByText("Pipeline 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Pipeline 11");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(screen.getByRole("textbox", { name: "Search by name" }), {
      target: { value: "discarded" },
    });
    setBackend(createBackend({ backendUrl: "https://other.example.com" }));
    await act(() => vi.advanceTimersByTimeAsync(250));
    vi.useRealTimers();

    expect(await screen.findByText("Pipeline 101")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 11")).not.toBeInTheDocument();
    expectNoPaginationControls();
    expect(screen.getByRole("textbox", { name: "Search by name" })).toHaveValue(
      "",
    );
    expect(listRemotePipelines).toHaveBeenLastCalledWith(
      "https://other.example.com",
      undefined,
      meFilterQuery,
    );
    expect(listRemotePipelines).not.toHaveBeenCalledWith(
      "https://other.example.com",
      "original-page-two",
      meFilterQuery,
    );
  });

  it("redistributes a dragged column's width equally to the columns on its right", async () => {
    const { table, handle, widths, startDrag, dragTo } =
      await renderResizableTable();

    expect(within(table).getAllByRole("separator")).toHaveLength(5);
    expect(
      within(
        within(table).getByRole("columnheader", { name: "Actions" }),
      ).queryByRole("separator"),
    ).not.toBeInTheDocument();
    expect(handle).toHaveAttribute("aria-valuenow", "20");
    expect(handle).toHaveAttribute("aria-valuemin", "8");
    expect(handle).toHaveAttribute("aria-valuemax", "32");
    startDrag();
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    dragTo(690);

    expect(widths()).toEqual([25, 15, 29, 9, 9, 13]);
    expect(handle).toHaveAttribute("aria-valuenow", "29");
    expect(handle).toHaveAttribute("aria-valuemax", "32");
    for (const date of [pipeline.created_at, pipeline.updated_at]) {
      expect(screen.getByTitle(date)).toHaveTextContent(formatDate(date));
    }
    expect(widths().reduce((total, width) => total + width, 0)).toBe(100);
    expect(screen.getByText(pipeline.user_id)).toHaveAttribute(
      "title",
      pipeline.user_id,
    );

    dragTo(630);
    expect(widths()).toEqual([25, 15, 23, 11, 11, 15]);
  });

  it("keeps columns above their minimum width during large drags", async () => {
    const { handle, widths, startDrag, dragTo } = await renderResizableTable();

    startDrag();
    dragTo(1600);
    expect(widths()).toEqual([25, 15, 32, 8, 8, 12]);
    expect(handle).toHaveAttribute("aria-valuenow", "32");
    expect(handle).toHaveAttribute("aria-valuemax", "32");

    dragTo(-400);
    expect(widths()).toEqual([25, 15, 8, 16, 16, 20]);
    expect(handle).toHaveAttribute("aria-valuenow", "8");
    expect(handle).toHaveAttribute("aria-valuemin", "8");
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

it("keeps saved remote pipelines reachable when new pipelines are saved in the browser", async () => {
  localStorage.setItem("pipelines:save-in-browser", "true");
  try {
    await renderDashboard();
    expect(
      screen.getByRole("tab", { name: "Remote Pipelines" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Example pipeline")).toBeInTheDocument();
    expect(listRemotePipelines).toHaveBeenCalled();
  } finally {
    localStorage.removeItem("pipelines:save-in-browser");
  }
});
