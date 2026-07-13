import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";

import { useTrackRecentlyViewedRun } from "./useTrackRecentlyViewedRun";

vi.mock("@/hooks/useRecentlyViewed", () => ({
  addRecentlyViewed: vi.fn(),
}));

interface RunProps {
  runId?: string;
  pipelineName?: string;
}

describe("useTrackRecentlyViewedRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records the run once its data is available", () => {
    const initialProps: RunProps = {};
    const { rerender } = renderHook(
      ({ runId, pipelineName }: RunProps) =>
        useTrackRecentlyViewedRun(runId, pipelineName),
      { initialProps },
    );

    expect(addRecentlyViewed).not.toHaveBeenCalled();

    rerender({ runId: "run-1", pipelineName: "Test Pipeline" });

    expect(addRecentlyViewed).toHaveBeenCalledWith({
      type: "run",
      id: "run-1",
      name: "Test Pipeline",
    });
  });
});
