import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { type ComponentProps, type ComponentType, useState } from "react";
import type { DateRange } from "react-day-picker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PipelineAnnotationFilter,
  RemotePipelineSortDirection,
  RemotePipelineSortField,
} from "@/types/pipelineSearch";

import { PipelineSection } from "./PipelineSection";
import type { PipelineEntry } from "./usePipelineFilters";
import type { PipelineListEntry } from "./usePipelineList";

const { initialFilters, remoteState, storage } = vi.hoisted(() => ({
  initialFilters: {
    searchQuery: "",
    userId: "me",
    dateRange: undefined as DateRange | undefined,
    annotations: [] as PipelineAnnotationFilter[],
    sortField: "updated_at" as RemotePipelineSortField,
    sortDirection: "desc" as RemotePipelineSortDirection,
  },
  storage: { scope: "account-a", remoteEnabled: true },
  remoteState: {
    rows: [] as PipelineEntry<PipelineListEntry>[],
    isPending: false,
    isFetching: false,
    error: undefined as string | undefined,
    showingCached: false,
    hasRemotePipelines: true as boolean | undefined,
    totalCount: 1,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a {...props} href={to} />
  ),
}));
vi.mock("@/routes/router", () => ({
  APP_ROUTES: { LEARN_EXAMPLES: "/learn/examples" },
}));
vi.mock("@/components/Learn/ExamplePipelines", () => ({
  ExamplePipelines: () => null,
}));
vi.mock("@/components/shared/NewPipelineButton", () => ({
  default: () => null,
}));
vi.mock("@/components/shared/SuspenseWrapper", () => ({
  withSuspenseWrapper: (Component: ComponentType) => Component,
}));
vi.mock("@/services/pipelineService", () => ({ deletePipeline: vi.fn() }));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("./usePipelineList", () => ({
  usePipelineList: () => ({
    data: {
      pipelines: new Map([["local-pipeline", { name: "Local report" }]]),
    },
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("./useRemotePipelineList", () => ({
  useRemotePipelineList: () => {
    const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
    const [userId, setUserId] = useState(initialFilters.userId);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(
      initialFilters.dateRange,
    );
    const [annotations, setAnnotations] = useState<PipelineAnnotationFilter[]>(
      initialFilters.annotations,
    );
    const [sortField, setSortField] = useState(initialFilters.sortField);
    const [sortDirection, setSortDirection] = useState(
      initialFilters.sortDirection,
    );
    return {
      ...remoteState,
      searchQuery,
      setSearchQuery,
      userId,
      setUserId,
      dateRange,
      setDateRange,
      annotations,
      setAnnotations,
      sortField,
      setSortField,
      sortDirection,
      setSortDirection,
      clearFilters: () => {
        setSearchQuery("");
        setUserId("me");
        setDateRange(undefined);
        setAnnotations([]);
      },
      resultCount: remoteState.isPending ? undefined : remoteState.rows.length,
      hasMoreResults: false,
      hasSearchFilters:
        !!searchQuery ||
        userId !== "me" ||
        !!dateRange ||
        annotations.length > 0,
      filterKey: JSON.stringify([
        searchQuery,
        userId,
        dateRange,
        annotations,
        sortField,
        sortDirection,
      ]),
      refresh: vi.fn(),
      pagination: {
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        goToNextPage: vi.fn(),
        goToPreviousPage: vi.fn(),
        resetPage: vi.fn(),
      },
    };
  },
}));
vi.mock("./PipelineRow", () => ({
  default: ({ name }: { name: string }) => (
    <tr>
      <td>{name}</td>
    </tr>
  ),
}));
vi.mock("./BulkActionsBar", () => ({
  default: ({ selectedPipelines }: { selectedPipelines: string[] }) => (
    <div>{selectedPipelines.length} selected pipelines</div>
  ),
}));

beforeEach(() => {
  initialFilters.searchQuery = "";
  initialFilters.userId = "me";
  initialFilters.dateRange = undefined;
  initialFilters.annotations = [];
  initialFilters.sortField = "updated_at";
  initialFilters.sortDirection = "desc";
  storage.remoteEnabled = true;
  remoteState.rows = [
    [
      "remote-pipeline",
      { name: "Daily report" },
      {
        searchQuery: "",
        matchedFields: [],
        componentQuery: "",
        matchedComponentNames: [],
      },
    ],
  ];
  remoteState.isPending = false;
  remoteState.isFetching = false;
  remoteState.error = undefined;
  remoteState.showingCached = false;
  remoteState.hasRemotePipelines = true;
  remoteState.totalCount = 1;
});

afterEach(cleanup);

describe("PipelineSection remote search", () => {
  it.each([
    { label: "search", filters: { searchQuery: "missing-pipeline" } },
    { label: "owner", filters: { userId: "another-user" } },
    { label: "all owners", filters: { userId: "" } },
    {
      label: "date range",
      filters: { dateRange: { from: new Date(2026, 8, 18) } },
    },
    {
      label: "annotations",
      filters: { annotations: [{ key: "team", value: "missing" }] },
    },
  ])(
    "opens Remote for restored $label filters with zero matches",
    ({ filters }) => {
      Object.assign(initialFilters, filters);
      remoteState.rows = [];
      remoteState.hasRemotePipelines = false;
      remoteState.totalCount = 0;

      render(<PipelineSection />);

      expect(
        screen.getByRole("tab", { name: /Remote pipelines/ }),
      ).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("No pipelines found.")).toBeVisible();
    },
  );

  it("preserves an explicit Local tab choice when restored remote filters have no matches", () => {
    initialFilters.searchQuery = "missing-pipeline";
    remoteState.rows = [];
    remoteState.hasRemotePipelines = false;
    remoteState.totalCount = 0;
    const { rerender } = render(<PipelineSection />);

    fireEvent.click(screen.getByRole("tab", { name: /Local pipelines/ }));
    remoteState.isPending = true;
    remoteState.hasRemotePipelines = undefined;
    rerender(<PipelineSection />);

    expect(
      screen.getByRole("tab", { name: /Local pipelines/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Local report")).toBeVisible();
  });

  it.each([
    { sortField: "name", sortDirection: "desc" },
    { sortField: "updated_at", sortDirection: "asc" },
  ] as const)(
    "opens Remote for restored $sortField $sortDirection sorting without filters or pipelines",
    (sorting) => {
      Object.assign(initialFilters, sorting);
      remoteState.rows = [];
      remoteState.hasRemotePipelines = false;
      remoteState.totalCount = 0;

      render(<PipelineSection />);

      expect(
        screen.getByRole("tab", { name: /Remote pipelines/ }),
      ).toHaveAttribute("aria-selected", "true");
      expect(
        screen.getByText(
          "No remote pipelines yet. Create a pipeline or save one from Local pipelines.",
        ),
      ).toBeVisible();
      expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
    },
  );

  it("defaults to Local when there are no remote pipelines or filters", () => {
    remoteState.rows = [];
    remoteState.hasRemotePipelines = false;
    remoteState.totalCount = 0;

    render(<PipelineSection />);

    expect(
      screen.getByRole("tab", { name: /Local pipelines/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("keeps search focused and the Remote tab selected through loading and zero matches", () => {
    const { rerender } = render(<PipelineSection />);
    const search = screen.getByRole("textbox", {
      name: "Search remote pipelines",
    });
    search.focus();
    fireEvent.change(search, { target: { value: "missing-pipeline" } });

    remoteState.isPending = true;
    remoteState.rows = [];
    remoteState.hasRemotePipelines = undefined;
    rerender(<PipelineSection />);
    expect(screen.getByText("Loading remote pipelines")).toBeVisible();
    expect(search).toHaveFocus();
    expect(
      screen.getByRole("textbox", { name: "Search remote pipelines" }),
    ).toBe(search);

    remoteState.isPending = false;
    remoteState.hasRemotePipelines = false;
    remoteState.totalCount = 0;
    rerender(<PipelineSection />);
    expect(screen.getByText("No pipelines found.")).toBeVisible();
    expect(
      screen.getByRole("tab", { name: /Remote pipelines/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(search).toHaveFocus();
    expect(search).toHaveValue("missing-pipeline");
  });

  it("keeps the Remote tab selected when the owner filter has no matches", () => {
    const { rerender } = render(<PipelineSection />);
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Filter remote pipelines by owner",
      }),
      { target: { value: "another-user" } },
    );
    remoteState.rows = [];
    remoteState.hasRemotePipelines = false;
    remoteState.totalCount = 0;
    rerender(<PipelineSection />);

    expect(
      screen.getByRole("tab", { name: /Remote pipelines/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("No pipelines found.")).toBeVisible();
  });

  it("clears bulk selection when a search changes even if the same row remains", () => {
    render(<PipelineSection />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select pipelines on this page" }),
    );
    expect(screen.getByText("1 selected pipelines")).toBeVisible();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search remote pipelines" }),
      { target: { value: "Daily" } },
    );

    expect(screen.queryByText("1 selected pipelines")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select pipelines on this page" }),
    ).not.toBeChecked();
  });

  it("keeps the Remote tab selected when an annotation filter has no matches", () => {
    const { rerender } = render(<PipelineSection />);
    const remotePanel = within(
      screen.getByRole("tabpanel", { name: /Remote pipelines/ }),
    );
    fireEvent.click(remotePanel.getByRole("button", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByPlaceholderText("Key"), {
      target: { value: "team" },
    });
    fireEvent.change(screen.getByPlaceholderText("Value (optional)"), {
      target: { value: "missing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    remoteState.rows = [];
    remoteState.hasRemotePipelines = false;
    remoteState.totalCount = 0;
    rerender(<PipelineSection />);

    expect(
      screen.getByRole("tab", { name: /Remote pipelines/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("No pipelines found.")).toBeVisible();
    expect(screen.getByText("team: missing")).toBeVisible();
  });

  it("shows a failed search without claiming cached results are available", () => {
    const { rerender } = render(<PipelineSection />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search remote pipelines" }),
      { target: { value: "Daily" } },
    );
    remoteState.rows = [];
    remoteState.error = "Server unavailable";
    remoteState.totalCount = 0;
    remoteState.hasRemotePipelines = undefined;
    rerender(<PipelineSection />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load remote pipelines: Server unavailable",
    );
    expect(screen.getByText("No pipelines found.")).toBeVisible();
    expect(
      screen.queryByText("No cached remote pipelines are available."),
    ).not.toBeInTheDocument();
  });
});
