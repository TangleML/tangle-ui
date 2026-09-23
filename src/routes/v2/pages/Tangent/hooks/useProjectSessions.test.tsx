import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/projects/projectResourcesService");

let backend = { configured: true, available: true };
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

import * as projectResourcesService from "@/services/projects/projectResourcesService";
import type {
  ProjectResource,
  ProjectResourcePage,
} from "@/services/projects/types";

import { useProjectSessions } from "./useProjectSessions";

function sessionResource(
  overrides: Partial<ProjectResource> = {},
): ProjectResource {
  return {
    id: "r1",
    projectId: "p1",
    entity: "agent_session",
    name: null,
    entityId: "sess-1",
    extraData: null,
    createdBy: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    payload: null,
    ...overrides,
  };
}

function page(items: ProjectResource[]): ProjectResourcePage {
  return { items, nextPageToken: null, totalCount: items.length };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
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

describe("useProjectSessions", () => {
  it("queries only agent_session resources", async () => {
    vi.mocked(projectResourcesService.listProjectResources).mockResolvedValue(
      page([sessionResource()]),
    );

    const { result } = renderHook(() => useProjectSessions("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(projectResourcesService.listProjectResources).toHaveBeenCalledWith(
      "p1",
      { entity: ["agent_session"] },
    );
  });

  it("maps rows to sessions newest first and drops rows without an entityId", async () => {
    vi.mocked(projectResourcesService.listProjectResources).mockResolvedValue(
      page([
        sessionResource({
          id: "r-old",
          entityId: "sess-old",
          createdAt: new Date("2024-01-01T00:00:00Z"),
        }),
        sessionResource({
          id: "r-new",
          entityId: "sess-new",
          createdAt: new Date("2024-02-01T00:00:00Z"),
        }),
        sessionResource({ id: "r-null", entityId: null }),
      ]),
    );

    const { result } = renderHook(() => useProjectSessions("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    expect(result.current.sessions.map((s) => s.sessionId)).toEqual([
      "sess-new",
      "sess-old",
    ]);
    expect(result.current.sessions[0]).toEqual({
      resourceId: "r-new",
      sessionId: "sess-new",
      name: null,
      createdAt: new Date("2024-02-01T00:00:00Z"),
    });
  });

  it("attachSession creates an agent_session resource", async () => {
    vi.mocked(projectResourcesService.listProjectResources).mockResolvedValue(
      page([]),
    );
    vi.mocked(projectResourcesService.createProjectResource).mockResolvedValue(
      sessionResource({ id: "r-created", entityId: "sess-2" }),
    );

    const { result } = renderHook(() => useProjectSessions("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await act(async () => {
      await result.current.attachSession("sess-2");
    });

    expect(projectResourcesService.createProjectResource).toHaveBeenCalledWith(
      "p1",
      { entity: "agent_session", entityId: "sess-2" },
    );
  });

  it("detachSession deletes the resource by id", async () => {
    vi.mocked(projectResourcesService.listProjectResources).mockResolvedValue(
      page([]),
    );
    vi.mocked(projectResourcesService.deleteProjectResource).mockResolvedValue(
      undefined,
    );

    const { result } = renderHook(() => useProjectSessions("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await act(async () => {
      await result.current.detachSession("r1");
    });

    expect(projectResourcesService.deleteProjectResource).toHaveBeenCalledWith(
      "p1",
      "r1",
    );
  });
});
