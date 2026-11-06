import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectResourceItems } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { useProjectRuns } from "@/services/projects/useProjectRuns";

import { CanvasEmptyState } from "./CanvasEmptyState";

const openWorkareaTarget = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1", openWorkareaTarget }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectResourceItems", () => ({
  useProjectResourceItems: vi.fn(),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useProjectRuns: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

const PIPELINE = {
  id: "resource-1",
  name: "Churn pipeline",
  icon: "GitBranch",
  description: "Pipeline",
  target: { type: "pipeline", identity: "id/pipeline-1" },
};

function given({ resources = [] as unknown[], runs = [] as unknown[] } = {}) {
  vi.mocked(useProjectResourceItems).mockReturnValue({
    resources,
  } as unknown as ReturnType<typeof useProjectResourceItems>);
  vi.mocked(useProjectRuns).mockReturnValue({
    data: runs,
  } as unknown as ReturnType<typeof useProjectRuns>);
}

describe("CanvasEmptyState", () => {
  beforeEach(() => given());
  afterEach(() => vi.resetAllMocks());

  it("says nothing is open, and offers nothing more when the project is empty", () => {
    render(<CanvasEmptyState />);

    expect(screen.getByText("Nothing open yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Jump back in" })).toBeNull();
  });

  it("offers the project's pipelines and recent runs", () => {
    given({
      resources: [PIPELINE],
      runs: [{ id: "run-7", pipelineName: "Nightly", createdAt: null }],
    });

    render(<CanvasEmptyState />);

    const list = screen.getByRole("list", { name: "Jump back in" });
    expect(list).toHaveTextContent("Churn pipeline");
    expect(list).toHaveTextContent("Nightly");
  });

  /** A pipeline from another browser is listed elsewhere, but cannot open here. */
  it("leaves out what cannot be opened", () => {
    given({ resources: [{ ...PIPELINE, target: undefined }] });

    render(<CanvasEmptyState />);

    expect(screen.queryByText("Churn pipeline")).toBeNull();
  });

  it("opens a suggestion in the canvas", async () => {
    const user = userEvent.setup();
    given({ resources: [PIPELINE] });

    render(<CanvasEmptyState />);
    await user.click(screen.getByRole("button", { name: /Churn pipeline/ }));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      PIPELINE.target,
      "Churn pipeline",
    );
  });
});
