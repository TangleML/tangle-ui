import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { fetchRunAnnotations } from "@/services/pipelineRunService";
import { projectRunAnnotations } from "@/utils/projectRunAnnotation";

import { useRerunProjectIds } from "./useRerunProjectIds";

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: vi.fn(),
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.test" }),
}));

const PROJECT = "035d6de5-23d6-402b-ad7e-9a7359194caf";
const OTHER = "a1a58adc-e035-47de-afea-0eef486bb82f";

function renderProjectIds() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRerunProjectIds(), { wrapper });
  return { read: result.current, client };
}

describe("useRerunProjectIds", () => {
  beforeEach(() => {
    vi.mocked(isFlagEnabled).mockReturnValue(true);
    vi.mocked(fetchRunAnnotations).mockResolvedValue({
      source: "web-app",
      ...projectRunAnnotations([PROJECT]),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reruns into the project the original run belonged to", async () => {
    const { read } = renderProjectIds();

    expect(await read("01a0ab76")).toEqual([PROJECT]);
    expect(fetchRunAnnotations).toHaveBeenCalledWith(
      "01a0ab76",
      "https://backend.test",
    );
  });

  it("keeps every project of a run that belonged to more than one", async () => {
    vi.mocked(fetchRunAnnotations).mockResolvedValue(
      projectRunAnnotations([PROJECT, OTHER]),
    );
    const { read } = renderProjectIds();

    expect(await read("01a0ab76")).toEqual([PROJECT, OTHER]);
  });

  it("finds no project for a run that belonged to none", async () => {
    vi.mocked(fetchRunAnnotations).mockResolvedValue({ source: "web-app" });
    const { read } = renderProjectIds();

    expect(await read("01a0ab76")).toEqual([]);
  });

  /** A run's projects cannot be set afterwards, so guessing is worse than failing. */
  it("refuses the rerun rather than starting one that belongs nowhere", async () => {
    vi.mocked(fetchRunAnnotations).mockRejectedValue(
      new Error("Backend said no"),
    );
    const { read } = renderProjectIds();

    await expect(read("01a0ab76")).rejects.toThrow("Backend said no");
  });

  it("reads a run it is only told the number of", async () => {
    const { read } = renderProjectIds();

    await read(12345);

    expect(fetchRunAnnotations).toHaveBeenCalledWith(
      "12345",
      "https://backend.test",
    );
  });

  it("asks nothing of the backend when there is no run to read", async () => {
    const { read } = renderProjectIds();

    expect(await read(undefined)).toEqual([]);
    expect(await read(null)).toEqual([]);
    expect(fetchRunAnnotations).not.toHaveBeenCalled();
  });

  /** Someone not using projects should not have their reruns depend on them. */
  it("asks nothing of the backend while projects are switched off", async () => {
    vi.mocked(isFlagEnabled).mockReturnValue(false);
    const { read } = renderProjectIds();

    expect(await read("01a0ab76")).toEqual([]);
    expect(fetchRunAnnotations).not.toHaveBeenCalled();
  });

  it("reuses what a run's annotations were already read for", async () => {
    const { read } = renderProjectIds();

    await read("01a0ab76");
    await read("01a0ab76");

    expect(fetchRunAnnotations).toHaveBeenCalledTimes(1);
  });
});
