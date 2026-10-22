import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";

import { useTrackRecentlyViewedPipeline } from "./useTrackRecentlyViewedPipeline";

vi.mock("@/hooks/useRecentlyViewed", () => ({
  addRecentlyViewed: vi.fn(),
}));

describe("useTrackRecentlyViewedPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records the pipeline by the name it reopens under", () => {
    renderHook(() => useTrackRecentlyViewedPipeline("My Pipeline"));

    expect(addRecentlyViewed).toHaveBeenCalledWith({
      type: "pipeline",
      id: "My Pipeline",
      name: "My Pipeline",
    });
  });

  it("records nothing without a pipeline", () => {
    renderHook(() => useTrackRecentlyViewedPipeline(null));

    expect(addRecentlyViewed).not.toHaveBeenCalled();
  });
});
