import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";

import {
  type PipelineFilterEntry,
  usePipelineFilters,
} from "./usePipelineFilters";

afterEach(cleanup);

function componentRef(
  spec: Partial<ComponentSpec> = {},
): ComponentReferenceWithSpec {
  return {
    digest: "same-content-digest",
    text: "",
    spec: { implementation: { graph: { tasks: {} } }, ...spec },
  };
}

function entry(
  name: string,
  overrides: Partial<PipelineFilterEntry> = {},
): PipelineFilterEntry {
  return {
    name,
    componentRef: componentRef(),
    modificationTime: new Date(2026, 8, 18, 12),
    ...overrides,
  };
}

describe("usePipelineFilters", () => {
  it("keeps equal display names and content distinct by their opaque identities", () => {
    const local = entry("Daily report");
    const remote = entry("Daily report");
    const pipelines = new Map([
      ["local-id", local],
      ["remote:backend:remote-id", remote],
    ]);
    const { result } = renderHook(() => usePipelineFilters(pipelines));

    act(() => result.current.filterBarProps.setSearchQuery("daily REPORT"));

    expect(result.current.filteredPipelines.map(([id]) => id)).toEqual([
      "local-id",
      "remote:backend:remote-id",
    ]);
    expect(result.current.filteredPipelines.map(([, file]) => file)).toEqual([
      local,
      remote,
    ]);
    expect(result.current.filterBarProps).toMatchObject({
      totalCount: 2,
      filteredCount: 2,
    });
  });

  it("searches and sorts display names, not storage identifiers", () => {
    const pipelines = new Map([
      ["remote:aaa", entry("Zulu")],
      ["remote:zzz", entry("Alpha")],
    ]);
    const { result } = renderHook(() => usePipelineFilters(pipelines));

    act(() => {
      result.current.filterBarProps.setSortField("name");
      result.current.filterBarProps.setSortDirection("asc");
    });
    expect(result.current.filteredPipelines.map(([id]) => id)).toEqual([
      "remote:zzz",
      "remote:aaa",
    ]);

    act(() => result.current.filterBarProps.setSortDirection("desc"));
    expect(result.current.filteredPipelines.map(([id]) => id)).toEqual([
      "remote:aaa",
      "remote:zzz",
    ]);

    act(() => result.current.filterBarProps.setSearchQuery("ALPHA"));
    expect(result.current.filteredPipelines.map(([id]) => id)).toEqual([
      "remote:zzz",
    ]);

    act(() => result.current.filterBarProps.setSearchQuery("remote:"));
    expect(result.current.filteredPipelines).toEqual([]);
  });

  it.each([
    ["Experiment", "Description", "Experiment tracking"],
    ["Alice", "Author", "Alice Example"],
    ["nightly", "Note", "Run nightly"],
  ])(
    "preserves %s metadata search and match details",
    (query, label, value) => {
      const pipelines = new Map([
        [
          "remote-id",
          entry("Analysis", {
            componentRef: componentRef({
              description: "Experiment tracking",
              metadata: {
                annotations: { author: "Alice Example", notes: "Run nightly" },
              },
            }),
          }),
        ],
        ["other-id", entry("Other pipeline")],
      ]);
      const { result } = renderHook(() => usePipelineFilters(pipelines));

      act(() =>
        result.current.filterBarProps.setSearchQuery(query.toUpperCase()),
      );

      expect(result.current.filteredPipelines).toHaveLength(1);
      expect(result.current.filteredPipelines[0]).toEqual([
        "remote-id",
        pipelines.get("remote-id"),
        {
          searchQuery: query.toUpperCase(),
          matchedFields: [{ label, value }],
          componentQuery: "",
          matchedComponentNames: [],
        },
      ]);
    },
  );

  it("matches immediate component reference and spec names without duplicate match labels", () => {
    const implementation = {
      graph: {
        tasks: {
          first: {
            componentRef: {
              name: "Transform CSV",
              spec: {
                name: "Transform table",
                implementation: { container: { image: "python:3" } },
              },
            },
          },
          second: { componentRef: { name: "Transform CSV" } },
          nested: {
            componentRef: {
              spec: {
                implementation: {
                  graph: {
                    tasks: {
                      deeper: { componentRef: { name: "Nested only" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const pipelines = new Map([
      [
        "graph-id",
        entry("Analysis", { componentRef: componentRef({ implementation }) }),
      ],
      [
        "container-id",
        entry("Container", {
          componentRef: componentRef({
            implementation: { container: { image: "python:3" } },
          }),
        }),
      ],
    ]);
    const { result } = renderHook(() => usePipelineFilters(pipelines));

    act(() => result.current.filterBarProps.setComponentQuery("TRANSFORM"));

    expect(result.current.filteredPipelines).toHaveLength(1);
    expect(result.current.filteredPipelines[0]?.[0]).toBe("graph-id");
    expect(result.current.filteredPipelines[0]?.[2]).toMatchObject({
      componentQuery: "TRANSFORM",
      matchedComponentNames: ["Transform CSV", "Transform table"],
    });

    act(() => result.current.filterBarProps.setComponentQuery("table"));
    expect(result.current.filteredPipelines).toHaveLength(1);
    expect(
      result.current.filteredPipelines[0]?.[2].matchedComponentNames,
    ).toEqual(["Transform table"]);

    act(() => result.current.filterBarProps.setComponentQuery("nested only"));
    expect(result.current.filteredPipelines).toEqual([]);
  });

  it("filters date ranges inclusively by day and excludes unknown modification dates", () => {
    const pipelines = new Map([
      [
        "before",
        entry("Before", { modificationTime: new Date(2026, 8, 16, 23, 59) }),
      ],
      ["start", entry("Start", { modificationTime: new Date(2026, 8, 17) })],
      [
        "end",
        entry("End", { modificationTime: new Date(2026, 8, 18, 23, 59) }),
      ],
      [
        "after",
        entry("After", { modificationTime: new Date(2026, 8, 19, 12) }),
      ],
      ["unknown", entry("Unknown", { modificationTime: undefined })],
    ]);
    const { result } = renderHook(() => usePipelineFilters(pipelines));

    act(() =>
      result.current.filterBarProps.setDateRange({
        from: new Date(2026, 8, 17),
        to: new Date(2026, 8, 18),
      }),
    );

    expect(result.current.filteredPipelines.map(([id]) => id)).toEqual([
      "end",
      "start",
    ]);
    expect(result.current.filterBarProps).toMatchObject({
      totalCount: 5,
      filteredCount: 2,
      hasActiveFilters: true,
      activeFilterCount: 1,
    });

    act(() => result.current.filterBarProps.clearFilters());
    expect(result.current.filteredPipelines).toHaveLength(5);
    expect(result.current.filterBarProps.hasActiveFilters).toBe(false);
  });

  it("keeps a pipeline with an unavailable definition searchable by name", () => {
    const pipelines = new Map([
      ["remote-id", entry("Recovery draft", { componentRef: undefined })],
    ]);
    const { result } = renderHook(() => usePipelineFilters(pipelines));

    act(() => result.current.filterBarProps.setSearchQuery("RECOVERY"));

    expect(result.current.filteredPipelines).toHaveLength(1);
    expect(result.current.filteredPipelines[0]?.[2]).toMatchObject({
      matchedFields: [],
      matchedComponentNames: [],
    });

    act(() => result.current.filterBarProps.setComponentQuery("transform"));
    expect(result.current.filteredPipelines).toEqual([]);
  });
});
