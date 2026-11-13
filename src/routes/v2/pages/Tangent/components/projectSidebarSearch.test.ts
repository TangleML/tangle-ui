import { describe, expect, it } from "vitest";

import type { ProjectSession } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import type { ProjectSummary } from "@/services/projects/types";

import { searchProjects } from "./projectSidebarSearch";

const CHURN = { id: "project-1", name: "Churn model" } as ProjectSummary;
const FORECAST = { id: "project-2", name: "Q3 forecasting" } as ProjectSummary;

function session(
  sessionId: string,
  name: string | null,
  createdAt: string,
): ProjectSession {
  return {
    resourceId: `resource-${sessionId}`,
    sessionId,
    name,
    createdAt: new Date(createdAt),
  };
}

const SESSIONS = new Map([
  [
    CHURN.id,
    [
      session("s-1", null, "2026-01-01"),
      session("s-2", "Tune the threshold", "2026-01-02"),
    ],
  ],
  [FORECAST.id, [session("s-3", "Backfill March", "2026-01-03")]],
]);

const found = (query: string) =>
  searchProjects([CHURN, FORECAST], SESSIONS, query).map(
    ({ project, matchingSessionIds }) => [
      project.name,
      [...matchingSessionIds],
    ],
  );

describe("searchProjects", () => {
  it("finds a project by its name, whatever the case", () => {
    expect(found("CHURN")).toEqual([["Churn model", []]]);
  });

  it("finds a session by its name, under its project", () => {
    expect(found("threshold")).toEqual([["Churn model", ["s-2"]]]);
  });

  it("finds an unnamed session by the number it is shown with", () => {
    expect(found("session 1")).toEqual([["Churn model", ["s-1"]]]);
  });

  it("ignores the spaces around a query", () => {
    expect(found("  march ")).toEqual([["Q3 forecasting", ["s-3"]]]);
  });

  it("finds nothing when no project or session holds the query", () => {
    expect(found("retention")).toEqual([]);
  });
});
