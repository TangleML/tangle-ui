import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProjectSummary } from "@/services/projects/types";

import type { ProjectFilterBarProps } from "./useProjectFilters";
import { useProjectFilters } from "./useProjectFilters";

function makeProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "project-1",
    workspaceId: "workspace-1",
    name: "Churn model",
    description: null,
    createdBy: "alice@example.com",
    origin: "user",
    createdAt: new Date("2026-09-10T10:00:00Z"),
    updatedAt: new Date("2026-09-10T10:00:00Z"),
    resourceCounts: {},
    ...overrides,
  };
}

const PROJECTS: ProjectSummary[] = [
  makeProject({
    id: "a",
    name: "Churn model",
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-10T10:00:00Z"),
  }),
  makeProject({
    id: "b",
    name: "Fraud signals",
    createdBy: "bob@example.com",
    createdAt: new Date("2026-09-01T10:00:00Z"),
  }),
  makeProject({
    id: "c",
    name: "Churn dashboard",
    createdBy: "bob@example.com",
    createdAt: new Date("2026-08-01T10:00:00Z"),
  }),
];

function renderFilters(
  overrides: { projects?: ProjectSummary[]; currentUserId?: string } = {},
) {
  const { result } = renderHook(() =>
    useProjectFilters(
      overrides.projects ?? PROJECTS,
      "currentUserId" in overrides
        ? overrides.currentUserId
        : "alice@example.com",
    ),
  );

  return {
    names: () => result.current.filteredProjects.map((project) => project.name),
    bar: () => result.current.filterBarProps,
    set: (change: (bar: ProjectFilterBarProps) => void) =>
      act(() => change(result.current.filterBarProps)),
  };
}

describe("useProjectFilters", () => {
  it("shows every project when nothing is filtered", () => {
    const filters = renderFilters();

    expect(filters.names()).toEqual([
      "Churn model",
      "Fraud signals",
      "Churn dashboard",
    ]);
    expect(filters.bar().hasActiveFilters).toBe(false);
    expect(filters.bar().activeFilterCount).toBe(0);
  });

  it("keeps the order the backend returned", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setSearchQuery("churn"));

    expect(filters.names()).toEqual(["Churn model", "Churn dashboard"]);
  });

  it("matches a name regardless of case", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setSearchQuery("FRAUD"));

    expect(filters.names()).toEqual(["Fraud signals"]);
  });

  it("matches part of a name, not just the start", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setSearchQuery("signals"));

    expect(filters.names()).toEqual(["Fraud signals"]);
  });

  it("searches the name only, not the description", () => {
    const filters = renderFilters({
      projects: [makeProject({ name: "Churn model", description: "fraud" })],
    });

    filters.set((bar) => bar.setSearchQuery("fraud"));

    expect(filters.names()).toEqual([]);
  });

  it("ignores a search of nothing but whitespace", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setSearchQuery("   "));

    expect(filters.names()).toHaveLength(3);
    expect(filters.bar().hasActiveFilters).toBe(false);
  });

  it("filters by who created a project", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setAuthor("bob@"));

    expect(filters.names()).toEqual(["Fraud signals", "Churn dashboard"]);
  });

  it("reads 'me' as the signed-in user", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setAuthor("me"));

    expect(filters.names()).toEqual(["Churn model"]);
  });

  it("finds nothing for 'me' when there is no signed-in user", () => {
    const filters = renderFilters({ currentUserId: undefined });

    filters.set((bar) => bar.setAuthor("me"));

    expect(filters.names()).toEqual([]);
  });

  it("finds nothing for an author with no projects", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setAuthor("carol@example.com"));

    expect(filters.names()).toEqual([]);
  });

  it("keeps a project whose author is unknown out of an author filter", () => {
    const filters = renderFilters({
      projects: [makeProject({ createdBy: null })],
    });

    filters.set((bar) => bar.setAuthor("alice"));

    expect(filters.names()).toEqual([]);
  });

  it("filters by when a project was created", () => {
    const filters = renderFilters();

    filters.set((bar) =>
      bar.setDateRange({
        from: new Date("2026-09-01T00:00:00"),
        to: new Date("2026-09-30T00:00:00"),
      }),
    );

    expect(filters.names()).toEqual(["Churn model", "Fraud signals"]);
  });

  it("counts the whole of the closing day", () => {
    const filters = renderFilters({
      projects: [
        makeProject({
          name: "Late in the day",
          createdAt: new Date("2026-09-10T23:30:00"),
        }),
      ],
    });

    filters.set((bar) =>
      bar.setDateRange({
        from: new Date("2026-09-10T00:00:00"),
        to: new Date("2026-09-10T00:00:00"),
      }),
    );

    expect(filters.names()).toEqual(["Late in the day"]);
  });

  it("filters on creation rather than last update", () => {
    const filters = renderFilters({
      projects: [
        makeProject({
          name: "Old but busy",
          createdAt: new Date("2026-01-01T10:00:00"),
          updatedAt: new Date("2026-09-15T10:00:00"),
        }),
      ],
    });

    filters.set((bar) =>
      bar.setDateRange({
        from: new Date("2026-09-01T00:00:00"),
        to: new Date("2026-09-30T00:00:00"),
      }),
    );

    expect(filters.names()).toEqual([]);
  });

  it("combines the filters so each one narrows the last", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setSearchQuery("churn"));
    filters.set((bar) => bar.setAuthor("bob@"));

    expect(filters.names()).toEqual(["Churn dashboard"]);
    expect(filters.bar().activeFilterCount).toBe(2);
  });

  it("reports how much of the whole it is showing", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setSearchQuery("churn"));

    expect(filters.bar().totalCount).toBe(3);
    expect(filters.bar().filteredCount).toBe(2);
  });

  it("puts every project back when the filters are cleared", () => {
    const filters = renderFilters();

    filters.set((bar) => bar.setSearchQuery("churn"));
    filters.set((bar) => bar.setAuthor("bob@"));
    filters.set((bar) => bar.clearFilters());

    expect(filters.names()).toHaveLength(3);
    expect(filters.bar().hasActiveFilters).toBe(false);
    expect(filters.bar().searchQuery).toBe("");
    expect(filters.bar().author).toBeUndefined();
    expect(filters.bar().dateRange).toBeUndefined();
  });
});
