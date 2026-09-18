import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadPipelineByName } from "@/services/pipelineService";

import { useLoadComponentSpecFromPath } from "./useLoadComponentSpecFromPath";

const { clearComponentSpec, setComponentSpec } = vi.hoisted(() => ({
  clearComponentSpec: vi.fn(),
  setComponentSpec: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/editor/Daily%20report" }),
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://example.com" }),
}));
vi.mock("@/providers/ComponentSpecProvider", () => ({
  useComponentSpec: () => ({
    clearComponentSpec,
    setComponentSpec,
    componentSpec: undefined,
  }),
}));
vi.mock("@/services/pipelineService", () => ({
  loadPipelineByName: vi.fn(),
}));
vi.mock("@/services/executionService", () => ({
  fetchExecutionDetails: vi.fn(),
}));
vi.mock("@/routes/router", () => ({ RUNS_BASE_PATH: "/runs" }));

beforeEach(() => vi.clearAllMocks());

describe("useLoadComponentSpecFromPath", () => {
  it("shows the moved-to-remote error instead of reopening a local backup", async () => {
    const error =
      "This pipeline was moved to remote storage. Open it using the original account and backend.";
    vi.mocked(loadPipelineByName).mockResolvedValue({
      experiment: null,
      isLoading: false,
      error,
    });

    const { result } = renderHook(() => useLoadComponentSpecFromPath());

    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.isLoading).toBe(false);
    expect(setComponentSpec).not.toHaveBeenCalled();
    expect(clearComponentSpec).toHaveBeenCalled();
  });
});
