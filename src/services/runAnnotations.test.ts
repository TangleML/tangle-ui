import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRunAnnotations } from "@/services/pipelineRunService";

import { runAnnotationsQueryOptions } from "./runAnnotations";

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: vi.fn(),
}));

describe("runAnnotationsQueryOptions", () => {
  const backendUrl = "https://backend.example.com";
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("shares cached annotations between numeric and string run IDs", async () => {
    const annotations = { source: "web-app" };
    vi.mocked(fetchRunAnnotations).mockResolvedValue(annotations);

    expect(
      await queryClient.fetchQuery(runAnnotationsQueryOptions(123, backendUrl)),
    ).toEqual(annotations);
    expect(
      await queryClient.fetchQuery(
        runAnnotationsQueryOptions("123", backendUrl),
      ),
    ).toEqual(annotations);
    expect(fetchRunAnnotations).toHaveBeenCalledExactlyOnceWith(
      "123",
      backendUrl,
    );
  });

  it("keeps annotations for the same run ID separate across backends", async () => {
    const otherBackendUrl = "https://other.example.com";
    const annotations = { notes: "First backend" };
    const otherAnnotations = { notes: "Other backend" };
    vi.mocked(fetchRunAnnotations)
      .mockResolvedValueOnce(annotations)
      .mockResolvedValueOnce(otherAnnotations);

    expect(
      await queryClient.fetchQuery(
        runAnnotationsQueryOptions("123", backendUrl),
      ),
    ).toEqual(annotations);
    expect(
      await queryClient.fetchQuery(
        runAnnotationsQueryOptions("123", otherBackendUrl),
      ),
    ).toEqual(otherAnnotations);
    expect(fetchRunAnnotations).toHaveBeenCalledTimes(2);
    expect(fetchRunAnnotations).toHaveBeenNthCalledWith(1, "123", backendUrl);
    expect(fetchRunAnnotations).toHaveBeenNthCalledWith(
      2,
      "123",
      otherBackendUrl,
    );
  });
});
