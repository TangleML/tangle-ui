import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManageAccessButton } from "./ManageAccessButton";

const mockGetMyScopes = vi.hoisted(() => vi.fn());
const mockFetchRunAnnotations = vi.hoisted(() => vi.fn());

vi.mock("./accessControlApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./accessControlApi")>()),
  getMyScopes: mockGetMyScopes,
}));

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: mockFetchRunAnnotations,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://backend" }),
}));

vi.mock("./ManageAccessDialog", () => ({
  ManageAccessDialog: () => null,
}));

function renderButton(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  );
}

describe("ManageAccessButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRunAnnotations.mockResolvedValue({
      "tangleml.com/user-pipeline/pipeline-id": "pipeline-1",
    });
  });

  it("shows for callers the pipeline is shared with", async () => {
    mockGetMyScopes.mockResolvedValue(["run:cancel"]);

    renderButton(<ManageAccessButton runId="run-1" />);

    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(mockGetMyScopes).toHaveBeenCalledWith("pipeline", "pipeline-1");
  });

  it("stays hidden for callers with no grant", async () => {
    mockGetMyScopes.mockResolvedValue([]);

    renderButton(<ManageAccessButton runId="run-1" />);

    await waitFor(() => expect(mockGetMyScopes).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
