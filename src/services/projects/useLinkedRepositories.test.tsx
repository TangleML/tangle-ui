import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./projectResourcesService");

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ configured: true, available: true }),
}));

import * as projectResourcesService from "./projectResourcesService";
import { repositoryResourceInput } from "./resourceDescriptor";
import type { ProjectResource, ProjectResourceSummary } from "./types";
import { ProjectResourcesQueryKeys } from "./types";
import { useLinkedRepositories } from "./useLinkedRepositories";

const LINK_INPUT = repositoryResourceInput({
  owner: "TangleML",
  repo: "pipeline_components",
  ref: null,
  path: null,
  isPrivate: false,
  allowWrites: true,
});

const summary = (
  overrides: Partial<ProjectResourceSummary>,
): ProjectResourceSummary => ({
  id: "r1",
  projectId: "p1",
  entity: "document",
  name: "Model card",
  entityId: null,
  metadata: null,
  createdBy: null,
  createdAt: new Date("2026-11-01"),
  updatedAt: new Date("2026-11-01"),
  ...overrides,
});

const repositoryRow = summary({
  id: "repo-1",
  name: LINK_INPUT.name,
  metadata: LINK_INPUT.metadata,
});
const documentRow = summary({ id: "doc-1" });

const link: ProjectResource = {
  ...repositoryRow,
  payload: LINK_INPUT.payload ?? null,
};

function renderLinked(
  resources: ProjectResourceSummary[],
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return renderHook(() => useLinkedRepositories("p1", resources), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("useLinkedRepositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectResourcesService.getProjectResource).mockResolvedValue(
      link,
    );
  });

  it("reads each linked repository in full, and nothing else", async () => {
    const { result } = renderLinked([documentRow, repositoryRow]);

    await waitFor(() => expect(result.current.get("repo-1")).toEqual(link));

    expect(projectResourcesService.getProjectResource).toHaveBeenCalledTimes(1);
    expect(projectResourcesService.getProjectResource).toHaveBeenCalledWith(
      "p1",
      "repo-1",
    );
    expect(result.current.has("doc-1")).toBe(false);
  });

  it("shares the single-resource cache, so an update shows without a refetch", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderLinked([repositoryRow], client);
    await waitFor(() => expect(result.current.get("repo-1")).toEqual(link));

    const updated = {
      ...link,
      payload: { ...link.payload, allowWrites: false },
    };
    client.setQueryData(ProjectResourcesQueryKeys.Id("p1", "repo-1"), updated);

    await waitFor(() =>
      expect(result.current.get("repo-1")?.payload).toEqual(updated.payload),
    );
    expect(projectResourcesService.getProjectResource).toHaveBeenCalledTimes(1);
  });
});
