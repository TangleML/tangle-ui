import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useChatReferences } from "./useChatReferences";

vi.mock("@/utils/date", () => ({
  formatRelativeTime: (date: Date) => `at ${date.toISOString().slice(0, 10)}`,
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectResourceItems", () => ({
  useProjectResourceItems: () => ({
    summaries: [
      { id: "r-1", createdAt: new Date("2026-11-01") },
      { id: "r-2", createdAt: new Date("2026-11-05") },
      { id: "r-3", createdAt: new Date("2026-11-06") },
    ],
    resources: [
      {
        id: "r-1",
        name: "Churn model",
        icon: "GitBranch",
        description: "Pipeline",
        target: { type: "pipeline", identity: "id/p-1" },
      },
      {
        id: "r-2",
        name: "Brief",
        icon: "FileText",
        description: "Document",
        target: { type: "document", identity: "id/r-2" },
      },
      {
        id: "r-3",
        name: "Old export",
        icon: "Box",
        description: "Not something this version can open",
      },
    ],
  }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useArchivedProjectItems", () => ({
  useArchivedProjectItems: () => ({
    archived: new Set(["run://id/run-5"]),
  }),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useProjectRuns: () => ({
    data: [
      {
        id: "run-5",
        pipelineName: "Archived",
        createdAt: new Date("2026-11-08"),
      },
      { id: "run-6", pipelineName: "Churn model", createdAt: null },
      {
        id: "run-7",
        pipelineName: null,
        createdAt: new Date("2026-11-07"),
      },
    ],
  }),
}));

describe("useChatReferences", () => {
  it("offers pipelines, documents and runs by their workarea target, newest first, leaving out what's archived", () => {
    const { result } = renderHook(() => useChatReferences("project-1"));

    expect(result.current).toEqual([
      {
        kind: "document",
        label: "Brief",
        href: "document://id/r-2",
        detail: "at 2026-11-05",
      },
      {
        kind: "pipeline",
        label: "Churn model",
        href: "pipeline://id/p-1",
        detail: "at 2026-11-01",
      },
      {
        kind: "run",
        label: "Unnamed pipeline",
        href: "run://id/run-7",
        detail: "at 2026-11-07",
      },
      {
        kind: "run",
        label: "Churn model",
        href: "run://id/run-6",
        detail: undefined,
      },
    ]);
  });
});
