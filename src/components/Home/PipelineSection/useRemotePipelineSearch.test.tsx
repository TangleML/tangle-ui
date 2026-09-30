import {
  createBrowserHistory,
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
} from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRemotePipelineSearch } from "./useRemotePipelineSearch";

async function renderSearch(initialEntries = ["/pipelines"]) {
  let current: ReturnType<typeof useRemotePipelineSearch> | undefined;
  const rootRoute = createRootRoute();
  const pipelinesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/pipelines",
    component: () => {
      current = useRemotePipelineSearch();
      return null;
    },
  });
  const history = createMemoryHistory({ initialEntries });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pipelinesRoute]),
    history,
  });
  await router.load();
  const view = render(<RouterProvider router={router} />);
  await waitFor(() => expect(current).toBeDefined());
  return {
    ...view,
    history,
    get current() {
      return current!;
    },
  };
}

afterEach(cleanup);

describe("useRemotePipelineSearch", () => {
  it("updates the browser URL without remounting, losing focus, scrolling, or adding history entries", async () => {
    const originalUrl = window.location.href;
    const originalState = window.history.state;
    window.history.replaceState(null, "", "/pipelines#results");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const scrollIntoView = vi.fn();
    const mounted = vi.fn();
    const unmounted = vi.fn();
    const rootRoute = createRootRoute();
    const pipelinesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/pipelines",
      component: () => {
        const search = useRemotePipelineSearch();
        const [note, setNote] = useState("");
        useEffect(() => {
          mounted();
          return unmounted;
        }, []);
        return (
          <>
            <input
              aria-label="Search remote pipelines"
              value={search.searchQuery}
              onChange={(event) => search.setSearchQuery(event.target.value)}
            />
            <input
              aria-label="Unsaved note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div
              id="results"
              ref={(element) => {
                if (element) element.scrollIntoView = scrollIntoView;
              }}
            >
              Pipeline results
            </div>
          </>
        );
      },
    });
    const history = createBrowserHistory();
    const router = createRouter({
      routeTree: rootRoute.addChildren([pipelinesRoute]),
      history,
      scrollRestoration: true,
    });
    try {
      await router.load();
      render(<RouterProvider router={router} />);
      const input = await screen.findByRole("textbox", {
        name: "Search remote pipelines",
      });
      const note = screen.getByRole("textbox", { name: "Unsaved note" });
      const historyLength = window.history.length;
      replaceState.mockClear();
      scrollTo.mockClear();
      scrollIntoView.mockClear();
      fireEvent.change(note, { target: { value: "Keep this draft" } });
      input.focus();

      for (const value of ["r", "re", "report"]) {
        fireEvent.change(input, { target: { value } });
        await waitFor(() =>
          expect(new URLSearchParams(window.location.search).get("q")).toBe(
            value,
          ),
        );
        await waitFor(() => expect(router.state.status).toBe("idle"));
      }

      expect(replaceState).toHaveBeenCalled();
      expect(window.location.pathname).toBe("/pipelines");
      expect(window.location.hash).toBe("#results");
      expect(window.history.length).toBe(historyLength);
      expect(
        screen.getByRole("textbox", { name: "Search remote pipelines" }),
      ).toBe(input);
      expect(input).toHaveFocus();
      expect(input).toHaveValue("report");
      expect(note).toHaveValue("Keep this draft");
      expect(mounted).toHaveBeenCalledTimes(1);
      expect(unmounted).not.toHaveBeenCalled();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      cleanup();
      history.destroy();
      vi.restoreAllMocks();
      window.history.replaceState(originalState, "", originalUrl);
    }
  });

  it("round-trips sorting and every filter through a shared URL, including special characters", async () => {
    const search = await renderSearch(["/pipelines?view=compact#results"]);
    const searchQuery = 'Daily / revenue?tag=a&b=1 #α "quoted"';
    const userId = "first+last@example.com";
    const dateRange = {
      from: new Date(2026, 2, 8),
      to: new Date(2026, 2, 9),
    };
    const annotations = [
      { key: "team/path", value: "data & metrics=✓" },
      { key: "flag" },
    ];

    act(() => {
      search.current.setSearchQuery(searchQuery);
      search.current.setUserId(userId);
      search.current.setDateRange(dateRange);
      search.current.setAnnotations(annotations);
      search.current.setSortField("name");
      search.current.setSortDirection("asc");
    });
    await waitFor(() => {
      expect(search.current.searchQuery).toBe(searchQuery);
      expect(search.current.userId).toBe(userId);
      expect(search.current.dateRange).toEqual(dateRange);
      expect(search.current.annotations).toEqual(annotations);
      expect(search.current.sortField).toBe("name");
      expect(search.current.sortDirection).toBe("asc");
    });
    const sharedUrl = search.history.location.href;
    const params = new URL(sharedUrl, "https://example.com").searchParams;
    expect(params.get("edited_from")).toBe("2026-03-08");
    expect(params.get("edited_to")).toBe("2026-03-09");
    expect(params.get("sort_field")).toBe("name");
    expect(params.get("sort_direction")).toBe("asc");
    expect(params.get("view")).toBe("compact");
    expect(search.history.location.hash).toBe("#results");
    expect(search.history.length).toBe(1);
    search.unmount();

    const restored = await renderSearch([sharedUrl]);
    expect(restored.current.searchQuery).toBe(searchQuery);
    expect(restored.current.userId).toBe(userId);
    expect(restored.current.dateRange).toEqual(dateRange);
    expect(restored.current.annotations).toEqual(annotations);
    expect(restored.current.sortField).toBe("name");
    expect(restored.current.sortDirection).toBe("asc");
    expect(restored.current.filters).toEqual({
      searchQuery,
      userId,
      modifiedAfter: new Date(2026, 2, 8).toISOString(),
      modifiedBefore: new Date(2026, 2, 10).toISOString(),
      annotations,
      sortField: "name",
      sortDirection: "asc",
    });
  });

  it("distinguishes all owners from the default owner and clears only filter parameters", async () => {
    const search = await renderSearch(["/pipelines?view=compact#results"]);
    expect(search.current.userId).toBe("me");

    act(() => search.current.setUserId(""));
    await waitFor(() => expect(search.current.userId).toBe(""));
    expect(search.current.filters.userId).toBeUndefined();
    const sharedUrl = search.history.location.href;
    expect(
      new URL(sharedUrl, "https://example.com").searchParams.get("owner"),
    ).toBe("");
    search.unmount();

    const restored = await renderSearch([sharedUrl]);
    expect(restored.current.userId).toBe("");
    act(() => {
      restored.current.setSearchQuery("report");
      restored.current.setDateRange({ from: new Date(2026, 8, 18) });
      restored.current.setAnnotations([{ key: "team", value: "data" }]);
      restored.current.setSortField("name");
      restored.current.setSortDirection("asc");
    });
    await waitFor(() => expect(restored.current.searchQuery).toBe("report"));

    act(() => restored.current.clearFilters());
    await waitFor(() => {
      expect(restored.current.searchQuery).toBe("");
      expect(restored.current.userId).toBe("me");
      expect(restored.current.dateRange).toBeUndefined();
      expect(restored.current.annotations).toEqual([]);
      expect(restored.current.sortField).toBe("name");
      expect(restored.current.sortDirection).toBe("asc");
    });
    expect(restored.history.location.href).toBe(
      "/pipelines?view=compact&sort_field=name&sort_direction=asc#results",
    );
  });

  it("removes default sorting parameters while retaining filters", async () => {
    const search = await renderSearch([
      "/pipelines?q=report&owner=&sort_field=name&sort_direction=asc#results",
    ]);

    act(() => {
      search.current.setSortField("updated_at");
      search.current.setSortDirection("desc");
    });
    await waitFor(() => {
      expect(search.current.sortField).toBe("updated_at");
      expect(search.current.sortDirection).toBe("desc");
    });
    expect(search.current.searchQuery).toBe("report");
    expect(search.current.userId).toBe("");
    expect(search.current.filters).toEqual({ searchQuery: "report" });
    expect(search.history.location.href).toBe(
      "/pipelines?q=report&owner=#results",
    );
  });

  it("restores filters and sorting on Back and Forward after editing the current URL", async () => {
    const search = await renderSearch([
      "/pipelines?q=first&owner=first-owner&edited_from=2026-09-18",
      "/pipelines?q=second&owner=second-owner&edited_to=2026-09-20&sort_field=name&sort_direction=asc",
    ]);
    expect(search.current.searchQuery).toBe("second");
    act(() => search.current.setSearchQuery("latest edit"));
    await waitFor(() => expect(search.current.searchQuery).toBe("latest edit"));
    expect(search.history.length).toBe(2);

    act(() => search.history.back());
    await waitFor(() => {
      expect(search.current.searchQuery).toBe("first");
      expect(search.current.userId).toBe("first-owner");
      expect(search.current.sortField).toBe("updated_at");
      expect(search.current.sortDirection).toBe("desc");
      expect(search.current.dateRange).toEqual({
        from: new Date(2026, 8, 18),
        to: undefined,
      });
    });

    act(() => search.history.forward());
    await waitFor(() => {
      expect(search.current.searchQuery).toBe("latest edit");
      expect(search.current.userId).toBe("second-owner");
      expect(search.current.sortField).toBe("name");
      expect(search.current.sortDirection).toBe("asc");
      expect(search.current.dateRange).toEqual({
        from: undefined,
        to: new Date(2026, 8, 20),
      });
    });
  });

  it("ignores malformed URL fields while retaining valid annotations", async () => {
    const annotations = [
      null,
      { key: 42 },
      { key: "   " },
      { key: "invalid-value", value: false },
      { key: "team", value: "data" },
      { key: "flag" },
    ];
    const params = new URLSearchParams({
      q: JSON.stringify({ unexpected: "object" }),
      owner: JSON.stringify(["unexpected"]),
      edited_from: "2026-02-30",
      edited_to: "not-a-date",
      annotations: JSON.stringify(annotations),
      sort_field: "unknown",
      sort_direction: JSON.stringify(["asc"]),
    });
    const search = await renderSearch([`/pipelines?${params}`]);

    expect(search.current.searchQuery).toBe("");
    expect(search.current.userId).toBe("me");
    expect(search.current.dateRange).toBeUndefined();
    expect(search.current.sortField).toBe("updated_at");
    expect(search.current.sortDirection).toBe("desc");
    expect(search.current.annotations).toEqual([
      { key: "team", value: "data" },
      { key: "flag" },
    ]);
    expect(search.current.filters).toEqual({
      userId: "me",
      annotations: [{ key: "team", value: "data" }, { key: "flag" }],
    });
  });
});
