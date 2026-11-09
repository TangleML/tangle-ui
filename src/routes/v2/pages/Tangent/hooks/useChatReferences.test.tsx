import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useChatReferences } from "./useChatReferences";

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectResourceItems", () => ({
  useProjectResourceItems: () => ({
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

vi.mock("@/services/projects/useProjectRuns", () => ({
  useProjectRuns: () => ({
    data: [{ id: "run-7", pipelineName: "Churn model", createdAt: undefined }],
  }),
}));

describe("useChatReferences", () => {
  it("offers the project's pipelines, documents and runs by their workarea target", () => {
    const { result } = renderHook(() => useChatReferences("project-1"));

    expect(result.current).toEqual([
      {
        kind: "pipeline",
        label: "Churn model",
        href: "pipeline://id/p-1",
        detail: "Pipeline",
      },
      {
        kind: "document",
        label: "Brief",
        href: "document://id/r-2",
        detail: "Document",
      },
      {
        kind: "run",
        label: "Churn model",
        href: "run://id/run-7",
        detail: undefined,
      },
    ]);
  });
});
