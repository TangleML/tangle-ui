import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/projects/projectsService");
vi.mock("@/services/projects/workspacesService");

let backend = { configured: true, available: true };
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

import { DEFAULT_TANGENT_BASE_URL } from "@/routes/v2/pages/Tangent/constants";
import {
  ProjectsApiError,
  WorkspacesApiError,
} from "@/services/projects/errors";
import * as projectsService from "@/services/projects/projectsService";
import type { Project, Workspace } from "@/services/projects/types";
import * as workspacesService from "@/services/projects/workspacesService";

import { useTangentBaseUrl } from "./useTangentBaseUrl";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    workspaceId: "w1",
    name: "Project",
    description: null,
    notes: null,
    origin: "user",
    createdBy: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    resourceCounts: {},
    extraData: null,
    ...overrides,
  };
}

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: "w1",
    name: "Workspace",
    description: null,
    isActive: true,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    extraData: null,
    ...overrides,
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  backend = { configured: true, available: true };
});

describe("useTangentBaseUrl", () => {
  it("reports the workspace's configured base url", async () => {
    vi.mocked(projectsService.getProject).mockResolvedValue(project());
    vi.mocked(workspacesService.getWorkspace).mockResolvedValue(
      workspace({ extraData: { tangentBaseUrl: "https://tangent.example" } }),
    );

    const { result } = renderHook(() => useTangentBaseUrl("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() =>
      expect(result.current.baseUrl).toBe("https://tangent.example"),
    );
    expect(result.current.isError).toBe(false);
  });

  // A 404 rather than a bare Error: these reads retry anything that is not a
  // 4xx, so a generic failure only reports itself after three backoffs.
  it("reports an error when the project cannot be loaded", async () => {
    vi.mocked(projectsService.getProject).mockRejectedValue(
      new ProjectsApiError("not found", 404),
    );

    const { result } = renderHook(() => useTangentBaseUrl("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
  });

  it("reports an error when the workspace cannot be loaded", async () => {
    vi.mocked(projectsService.getProject).mockResolvedValue(project());
    vi.mocked(workspacesService.getWorkspace).mockRejectedValue(
      new WorkspacesApiError("not found", 404),
    );

    const { result } = renderHook(() => useTangentBaseUrl("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // baseUrl still resolves to the localhost default, which is exactly why
    // callers have to gate on isError rather than trusting it.
    expect(result.current.baseUrl).toBe(DEFAULT_TANGENT_BASE_URL);
  });
});
