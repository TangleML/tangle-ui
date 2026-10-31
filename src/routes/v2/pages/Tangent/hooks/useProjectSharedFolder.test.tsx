import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { createTangentSharedFolder } from "@/routes/v2/pages/Tangent/services/sharedFolders";
import { getProject, updateProject } from "@/services/projects/projectsService";
import type { Project } from "@/services/projects/types";

import { useProjectSharedFolder } from "./useProjectSharedFolder";

vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  useRemoteEnvAuthToken: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Tangent/services/sharedFolders", () => ({
  createTangentSharedFolder: vi.fn(),
}));
vi.mock("@/services/projects/projectsService", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));

function project(metadata: Record<string, unknown> | null): Project {
  return {
    id: "project-1",
    workspaceId: "workspace-1",
    name: "Churn model",
    description: null,
    createdBy: null,
    origin: "user",
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
    resourceCounts: {},
  };
}

function given(
  overrides: { baseUrl?: string | null; authToken?: string } = {},
) {
  const { baseUrl, authToken } = {
    baseUrl: "http://shell.test",
    authToken: "token",
    ...overrides,
  };
  vi.mocked(useTangentBaseUrl).mockReturnValue({
    baseUrl,
    localAddress: null,
    isLoading: false,
    isError: false,
  });
  vi.mocked(useRemoteEnvAuthToken).mockReturnValue(authToken);
}

function render() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProjectSharedFolder("project-1"), { wrapper })
    .result.current;
}

describe("useProjectSharedFolder", () => {
  beforeEach(() => {
    given();
    vi.mocked(createTangentSharedFolder).mockResolvedValue({ id: "folder-1" });
    vi.mocked(updateProject).mockResolvedValue(project(null));
  });
  afterEach(() => vi.resetAllMocks());

  it("reuses the folder already stored on the project", async () => {
    vi.mocked(getProject).mockResolvedValue(
      project({ tangentSharedFolderId: "folder-0" }),
    );

    await expect(render()()).resolves.toBe("folder-0");
    expect(createTangentSharedFolder).not.toHaveBeenCalled();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("makes a folder named after the project and saves its id alongside the other keys", async () => {
    vi.mocked(getProject).mockResolvedValue(
      project({ startingPrompt: "Train it" }),
    );

    await expect(render()()).resolves.toBe("folder-1");
    expect(createTangentSharedFolder).toHaveBeenCalledWith({
      baseUrl: "http://shell.test",
      authToken: "token",
      name: "Churn model",
    });
    expect(updateProject).toHaveBeenCalledWith("project-1", {
      metadata: {
        startingPrompt: "Train it",
        tangentSharedFolderId: "folder-1",
      },
    });
  });

  /** Two stores would split the project's memory between them. */
  it("defers to a folder another tab saved while ours was being made", async () => {
    vi.mocked(getProject)
      .mockResolvedValueOnce(project(null))
      .mockResolvedValueOnce(project({ tangentSharedFolderId: "folder-9" }));

    await expect(render()()).resolves.toBe("folder-9");
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("makes one folder for back-to-back starts", async () => {
    let stored: Record<string, unknown> | null = null;
    vi.mocked(getProject).mockImplementation(async () => project(stored));
    vi.mocked(updateProject).mockImplementation(async (_id, input) => {
      stored = input.metadata ?? null;
      return project(stored);
    });
    const ensure = render();

    const [first, second] = await Promise.all([ensure(), ensure()]);

    expect(first).toBe("folder-1");
    expect(second).toBe("folder-1");
    expect(createTangentSharedFolder).toHaveBeenCalledTimes(1);
  });

  it("resolves undefined without Tangent or a signed-in user", async () => {
    given({ baseUrl: null });
    await expect(render()()).resolves.toBeUndefined();

    given({ authToken: undefined });
    await expect(render()()).resolves.toBeUndefined();

    expect(getProject).not.toHaveBeenCalled();
  });

  it("resolves undefined when the folder cannot be made", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getProject).mockResolvedValue(project(null));
    vi.mocked(createTangentSharedFolder).mockRejectedValue(new Error("down"));

    await expect(render()()).resolves.toBeUndefined();
    expect(updateProject).not.toHaveBeenCalled();
  });
});
