import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PipelineAnnotationFilter,
  RemotePipelineSortDirection,
  RemotePipelineSortField,
} from "@/types/pipelineSearch";

import { PipelineFiltersBar } from "./PipelineFiltersBar";
import { usePipelineFilters } from "./usePipelineFilters";

afterEach(cleanup);

function Filters({
  initialDateRange,
  totalCount = 12,
  resultCount = 12,
  hasMoreResults = false,
  isPending = false,
}: {
  initialDateRange?: DateRange;
  totalCount?: number;
  resultCount?: number;
  hasMoreResults?: boolean;
  isPending?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState("me");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialDateRange,
  );
  const [annotations, setAnnotations] = useState<PipelineAnnotationFilter[]>(
    [],
  );
  const [sortField, setSortField] =
    useState<RemotePipelineSortField>("updated_at");
  const [sortDirection, setSortDirection] =
    useState<RemotePipelineSortDirection>("desc");
  return (
    <PipelineFiltersBar
      filters={{
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
        totalCount,
        resultCount: isPending ? undefined : resultCount,
        hasMoreResults,
        clearFilters: () => {
          setSearchQuery("");
          setUserId("me");
          setDateRange(undefined);
          setAnnotations([]);
        },
      }}
    />
  );
}

function LocalFilters() {
  const { filterBarProps } = usePipelineFilters(
    new Map([["local-report", { name: "Local report" }]]),
  );
  return <PipelineFiltersBar filters={filterBarProps} />;
}

describe("PipelineFiltersBar", () => {
  it("retains local search, component filtering, and sorting in the shared bar", () => {
    render(<LocalFilters />);
    const search = screen.getByRole("textbox", {
      name: "Search local pipelines",
    });
    expect(screen.queryByRole("textbox", { name: /owner/ })).toBeNull();
    fireEvent.change(search, { target: { value: "report" } });
    expect(screen.getByText("Showing 1 of 1 pipelines")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.change(screen.getByPlaceholderText("Component name..."), {
      target: { value: "transform" },
    });
    expect(screen.getByText("Showing 0 of 1 pipelines")).toBeVisible();
    expect(screen.getByRole("button", { name: "Advanced 1" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all (2)" }));

    expect(search).toHaveValue("");
    expect(screen.getByPlaceholderText("Component name...")).toHaveValue("");
    expect(screen.getByText("Showing 1 of 1 pipelines")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Sort descending" }),
    ).toBeVisible();
  });

  it("shows local-style controls without counting the default owner as a filter", () => {
    render(<Filters />);

    expect(
      screen.getByRole("button", { name: "Last edited range" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Advanced" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Showing 12 of 12 pipelines")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
  });

  it("searches names or paths and clears search without changing the owner", () => {
    render(<Filters />);
    const search = screen.getByRole("textbox", {
      name: "Search remote pipelines",
    });
    const owner = screen.getByRole("textbox", {
      name: "Filter remote pipelines by owner",
    });
    expect(search).toHaveAttribute("placeholder", "Search by name or path...");
    expect(owner).toHaveValue("me");

    fireEvent.change(search, { target: { value: "reports/daily" } });
    expect(search).toHaveValue("reports/daily");
    fireEvent.click(
      screen.getByRole("button", { name: "Clear remote pipeline search" }),
    );
    expect(search).toHaveValue("");
    expect(owner).toHaveValue("me");
  });

  it("changes sorting without changing filters and preserves sorting when filters clear", () => {
    render(<Filters initialDateRange={{ from: new Date(2024, 0, 5) }} />);
    const search = screen.getByRole("textbox", {
      name: "Search remote pipelines",
    });
    const owner = screen.getByRole("textbox", {
      name: "Filter remote pipelines by owner",
    });
    const sort = screen.getByRole("combobox", {
      name: "Sort remote pipelines by",
    });
    expect(sort).toHaveTextContent("Last edited");
    fireEvent.change(search, { target: { value: "daily" } });
    fireEvent.change(owner, { target: { value: "another-user" } });

    fireEvent.click(sort);
    fireEvent.click(screen.getByRole("option", { name: "Name" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));

    expect(sort).toHaveTextContent("Name");
    expect(
      screen.getByRole("button", { name: "Sort descending" }),
    ).toBeVisible();
    expect(search).toHaveValue("daily");
    expect(owner).toHaveValue("another-user");
    expect(screen.getByRole("button", { name: "Jan 5, 2024" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear all (3)" }));

    expect(search).toHaveValue("");
    expect(owner).toHaveValue("me");
    expect(sort).toHaveTextContent("Name");
    expect(
      screen.getByRole("button", { name: "Sort descending" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));
    expect(
      screen.getByRole("button", { name: "Sort ascending" }),
    ).toBeVisible();
  });

  it("allows another owner, all owners, and restoring Me without changing the search", () => {
    render(<Filters />);
    const search = screen.getByRole("textbox", {
      name: "Search remote pipelines",
    });
    const owner = screen.getByRole("textbox", {
      name: "Filter remote pipelines by owner",
    });
    fireEvent.change(search, { target: { value: "reports" } });
    fireEvent.change(owner, { target: { value: "another-user" } });
    expect(owner).toHaveValue("another-user");

    fireEvent.click(screen.getByRole("button", { name: "Clear owner filter" }));
    expect(owner).toHaveValue("");
    expect(owner).toHaveAttribute("placeholder", "All owners");
    fireEvent.click(screen.getByRole("button", { name: "Me" }));
    expect(owner).toHaveValue("me");
    expect(search).toHaveValue("reports");
  });

  it("removes search and owner badges independently and restores the default owner", () => {
    render(<Filters />);
    const search = screen.getByRole("textbox", {
      name: "Search remote pipelines",
    });
    const owner = screen.getByRole("textbox", {
      name: "Filter remote pipelines by owner",
    });
    fireEvent.change(search, { target: { value: "daily" } });
    fireEvent.change(owner, { target: { value: "another-user" } });
    expect(screen.getByRole("button", { name: "Clear all (2)" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Search: daily filter" }),
    );
    expect(search).toHaveValue("");
    expect(owner).toHaveValue("another-user");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Owner: another-user filter",
      }),
    );
    expect(owner).toHaveValue("me");
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear owner filter" }));
    expect(screen.getByRole("button", { name: "Clear all (1)" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove All owners filter" }),
    );
    expect(owner).toHaveValue("me");
  });

  it("updates the edited date range through the calendar and removes its badge", () => {
    render(<Filters initialDateRange={{ from: new Date(2024, 0, 5) }} />);
    fireEvent.click(screen.getByRole("button", { name: "Jan 5, 2024" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Friday, January 12th, 2024" }),
    );
    expect(
      screen.getByRole("button", { name: "Jan 5, 2024 – Jan 12, 2024" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Edited: Jan 5 – Jan 12 filter",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Last edited range" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
  });

  it("clears every active filter and resets the owner to me", () => {
    render(
      <Filters
        initialDateRange={{
          from: new Date(2024, 0, 5),
          to: new Date(2024, 0, 12),
        }}
      />,
    );
    const search = screen.getByRole("textbox", {
      name: "Search remote pipelines",
    });
    const owner = screen.getByRole("textbox", {
      name: "Filter remote pipelines by owner",
    });
    fireEvent.change(search, { target: { value: "daily" } });
    fireEvent.change(owner, { target: { value: "another-user" } });
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByPlaceholderText("Key"), {
      target: { value: "team" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    fireEvent.click(screen.getByRole("button", { name: "Clear all (4)" }));
    expect(search).toHaveValue("");
    expect(owner).toHaveValue("me");
    expect(
      screen.getByRole("button", { name: "Last edited range" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Advanced" })).toBeVisible();
  });

  it("adds key-only and key-value annotations, keeps their count collapsed, and removes them", () => {
    render(<Filters />);
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByText("Annotations:")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByPlaceholderText("Key"), {
      target: { value: "team" },
    });
    fireEvent.change(screen.getByPlaceholderText("Value (optional)"), {
      target: { value: "data" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByPlaceholderText("Key"), {
      target: { value: "priority" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("team: data")).toBeVisible();
    expect(screen.getByText("priority")).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear all (2)" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Advanced 2" }));
    expect(screen.getByRole("button", { name: "Advanced 2" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("team: data")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Advanced 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove team filter" }));
    expect(screen.queryByText("team: data")).not.toBeInTheDocument();
    expect(screen.getByText("priority")).toBeVisible();
    expect(screen.getByRole("button", { name: "Advanced 1" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove priority filter" }),
    );
    expect(screen.getByRole("button", { name: "Advanced" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Clear all/ })).toBeNull();
  });

  it("edits an annotation without changing the other filters", () => {
    render(<Filters />);
    const search = screen.getByRole("textbox", {
      name: "Search remote pipelines",
    });
    fireEvent.change(search, { target: { value: "daily" } });
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByPlaceholderText("Key"), {
      target: { value: "team" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.doubleClick(screen.getByText("team"));
    fireEvent.change(screen.getByPlaceholderText("Key"), {
      target: { value: "department" },
    });
    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "research" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("department: research")).toBeVisible();
    expect(screen.queryByText("team")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Advanced 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear all (2)" })).toBeVisible();
    expect(search).toHaveValue("daily");
  });

  it("marks a partial loaded count and hides counts while a query is pending", () => {
    const { rerender } = render(
      <Filters totalCount={20} resultCount={3} hasMoreResults />,
    );
    expect(screen.getByText("Showing 3 of 20+ pipelines")).toBeVisible();

    rerender(<Filters totalCount={20} resultCount={3} isPending />);
    expect(screen.queryByText(/Showing .* pipelines/)).toBeNull();

    rerender(<Filters totalCount={20} resultCount={0} />);
    expect(screen.getByText("Showing 0 of 20 pipelines")).toBeVisible();
  });
});
