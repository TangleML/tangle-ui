import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SECTIONS,
  groupDashboardSections,
  moveSection,
  readDashboardLayout,
  saveDashboardLayout,
} from "./dashboardSections";

beforeEach(() => localStorage.clear());

describe("dashboard layout", () => {
  it("starts with smart defaults and preserves an intentionally empty layout", () => {
    expect(readDashboardLayout()).toEqual(DEFAULT_SECTIONS);
    saveDashboardLayout([]);
    expect(readDashboardLayout()).toEqual([]);
  });

  it("saves order, content and width without unfinished placeholders", () => {
    const sections = [
      { id: "runs", type: "runs" as const, width: 2 as const },
      { id: "blank", type: null, width: 3 as const },
    ];
    saveDashboardLayout(sections);
    expect(readDashboardLayout()).toEqual([sections[0]]);
  });

  it.each([
    {
      saved: [{ id: "catalog", type: "components", width: 3 }],
      expected: [],
    },
    {
      saved: [
        { id: "runs", type: "runs", width: 2 },
        { id: "catalog", type: "components", width: 1 },
        { id: "recent-components", type: "recent-components", width: 1 },
      ],
      expected: [
        { id: "runs", type: "runs", width: 2 },
        { id: "recent-components", type: "recent-components", width: 1 },
      ],
    },
  ])(
    "removes retired catalog sections without resetting the layout: $saved",
    ({ saved, expected }) => {
      localStorage.setItem("Home/dashboard-layout-v1", JSON.stringify(saved));
      expect(readDashboardLayout()).toEqual(expected);
    },
  );

  it.each([
    "invalid json",
    JSON.stringify([{ id: "a", type: "unknown", width: 1 }]),
    JSON.stringify([{ id: "a", type: "runs", width: 4 }]),
    JSON.stringify([
      { id: "a", type: "runs", width: 1 },
      { id: "a", type: "projects", width: 2 },
    ]),
  ])("recovers invalid stored layouts: %s", (value) => {
    localStorage.setItem("Home/dashboard-layout-v1", value);
    expect(readDashboardLayout()).toEqual(DEFAULT_SECTIONS);
  });

  it("moves sections in either direction without mutating the saved order", () => {
    const sections = DEFAULT_SECTIONS;
    const moved = moveSection(sections, sections[0].id, sections[2].id);
    expect(moved.slice(0, 3)).toEqual([sections[1], sections[2], sections[0]]);
    expect(moveSection(moved, sections[0].id, sections[1].id)).toEqual(
      sections,
    );
    expect(moveSection(sections, "missing", sections[0].id)).toBe(sections);
  });

  it("keeps the three default zones intact before empty sections are hidden", () => {
    expect(groupDashboardSections(DEFAULT_SECTIONS)).toEqual([
      DEFAULT_SECTIONS.slice(0, 3),
      DEFAULT_SECTIONS.slice(3, 5),
      DEFAULT_SECTIONS.slice(5),
    ]);
  });

  it("starts a new row when the next section cannot fit", () => {
    const sections = [
      { id: "projects", type: "projects" as const, width: 2 as const },
      { id: "pipelines", type: "pipelines" as const, width: 2 as const },
      { id: "favorites", type: "favorites" as const, width: 1 as const },
      { id: "runs", type: "runs" as const, width: 3 as const },
    ];
    expect(groupDashboardSections(sections)).toEqual([
      [sections[0]],
      [sections[1], sections[2]],
      [sections[3]],
    ]);
    expect(groupDashboardSections([])).toEqual([]);
  });
});
