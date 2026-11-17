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

  it("archives at once and saves it on the project for everyone", async () => {
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
      expect(result.current.isArchived("run://id/r-1")).toBe(true),
    );
    expect(services.updateProject).toHaveBeenCalledWith("project-1", {
      metadata: { theme: "dark", tangentArchived: ["run://id/r-1"] },
    });
  });

  it("says so and puts the item back when saving fails", async () => {
    services.getProject.mockResolvedValue({ metadata: null });
    let fail: (error: Error) => void = () => undefined;
    services.updateProject.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const { result } = renderArchive();
    await waitFor(() => expect(services.getProject).toHaveBeenCalled());

    act(() => result.current.archive("run://id/r-1"));
    await waitFor(() =>
      expect(result.current.isArchived("run://id/r-1")).toBe(true),
    );
    await waitFor(() => expect(services.updateProject).toHaveBeenCalled());
    act(() => fail(new Error("Couldn't save")));

    await waitFor(() =>
      expect(services.notify).toHaveBeenCalledWith("Couldn't save", "error"),
    );
    await waitFor(() =>
      expect(result.current.isArchived("run://id/r-1")).toBe(false),
    );
  });
});
