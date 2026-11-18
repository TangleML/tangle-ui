import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useArchivedProjectItems } from "./useArchivedProjectItems";

const services = vi.hoisted(() => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/services/projects/projectsService", () => ({
  getProject: services.getProject,
  updateProject: services.updateProject,
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ configured: true, available: true }),
}));
vi.mock("@/hooks/useToastNotification", () => ({
  default: () => services.notify,
}));

function renderArchive() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useArchivedProjectItems("project-1"), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("useArchivedProjectItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives an item and saves it on the project for everyone", async () => {
    services.getProject.mockResolvedValue({ metadata: { theme: "dark" } });
    services.updateProject.mockImplementation(
      async (_id: string, { metadata }: { metadata: unknown }) => {
        services.getProject.mockResolvedValue({ metadata });
        return { metadata };
      },
    );
    const { result } = renderArchive();
    await waitFor(() => expect(services.getProject).toHaveBeenCalled());

    act(() => result.current.archive("run://id/r-1"));

    await waitFor(() =>
      expect(result.current.archived.has("run://id/r-1")).toBe(true),
    );
    expect(services.updateProject).toHaveBeenCalledWith("project-1", {
      metadata: { theme: "dark", tangentArchived: ["run://id/r-1"] },
    });
  });

  it("says so when saving fails, and leaves the item where it was", async () => {
    services.getProject.mockResolvedValue({ metadata: null });
    services.updateProject.mockRejectedValue(new Error("Couldn't save"));
    const { result } = renderArchive();
    await waitFor(() => expect(services.getProject).toHaveBeenCalled());

    act(() => result.current.archive("run://id/r-1"));

    await waitFor(() =>
      expect(services.notify).toHaveBeenCalledWith("Couldn't save", "error"),
    );
    expect(result.current.archived.has("run://id/r-1")).toBe(false);
  });
});
