import { beforeEach, describe, expect, it, vi } from "vitest";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";

import { getDefaultRunPath, getRunPath } from "./runRoutes";

vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: vi.fn(),
}));

describe("run routes", () => {
  beforeEach(() => {
    vi.mocked(isFlagEnabled).mockReset();
  });

  it("builds V1 and V2 paths, including subgraph executions", () => {
    expect(getRunPath("run 1", "v1")).toBe("/runs/run%201");
    expect(getRunPath("run 1", "v2", "subgraph 1")).toBe(
      "/runs-v2/run%201/subgraph%201",
    );
  });

  it("uses the V2 run view when the V2 experience flag is enabled", () => {
    vi.mocked(isFlagEnabled).mockReturnValue(true);

    expect(getDefaultRunPath("run-1")).toBe("/runs-v2/run-1");
  });

  it("uses the V1 run view when the V2 experience flag is disabled", () => {
    vi.mocked(isFlagEnabled).mockReturnValue(false);

    expect(getDefaultRunPath("run-1")).toBe("/runs/run-1");
  });
});
