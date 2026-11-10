import type { EmbedResource, Tangent } from "@tangent/embed-react";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ListProjectResourcesParams,
  ProjectResourceSummary,
} from "@/services/projects/types";

import { createProjectCardHandlers } from "./createProjectCardHandlers";

const services = vi.hoisted(() => ({
  listProjectResources: vi.fn(),
  createProjectResource: vi.fn(),
  listProjectRuns: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
  listSessionFiles: vi.fn(),
  pinSessionFile: vi.fn(),
  unpinSessionFile: vi.fn(),
}));

vi.mock("@/services/projects/projectResourcesService", () => ({
  listProjectResources: services.listProjectResources,
  createProjectResource: services.createProjectResource,
}));
vi.mock("@/services/projects/projectRunsService", () => ({
  listProjectRuns: services.listProjectRuns,
}));
vi.mock("@/services/projects/projectsService", () => ({
  getProject: services.getProject,
  updateProject: services.updateProject,
}));
vi.mock("@/routes/v2/pages/Tangent/services/sessionFiles", () => ({
  listSessionFiles: services.listSessionFiles,
  pinSessionFile: services.pinSessionFile,
  unpinSessionFile: services.unpinSessionFile,
}));

function resource(
  id: string,
  fields: Partial<ProjectResourceSummary>,
): ProjectResourceSummary {
  return {
    id,
    projectId: "project-1",
    entity: "document",
    name: null,
    entityId: null,
    metadata: null,
    createdBy: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    ...fields,
  };
}

function hostEntry(uri: string, name: string): EmbedResource {
  return {
    id: uri,
    sessionId: "chat-1",
    kind: "host",
    name,
    uri,
    createdAt: "2026-11-05T10:00:00.000Z",
  };
}

function makeTangent(resources: EmbedResource[]): Tangent {
  return {
    newSession: vi.fn(),
    listResources: vi.fn().mockResolvedValue(resources),
    addResource: vi.fn().mockResolvedValue(undefined),
    removeResource: vi.fn(),
  };
}

function setup({
  cardResources = [],
  sessionResources = [],
  tangent = makeTangent([]),
  baseUrl = "https://tangent.example",
}: {
  cardResources?: ProjectResourceSummary[];
  sessionResources?: ProjectResourceSummary[];
  tangent?: Tangent;
  baseUrl?: string;
} = {}) {
  services.listProjectResources.mockImplementation(
    async (_projectId: string, params: ListProjectResourcesParams) => ({
      items: params.entity?.includes("agent_session")
        ? sessionResources
        : cardResources,
      nextPageToken: null,
      totalCount: 0,
    }),
  );
  const getRunDetails = vi.fn().mockResolvedValue({ pipeline_name: "Train" });
  const onResourcesChanged = vi.fn().mockResolvedValue(undefined);
  const handlers = createProjectCardHandlers({
    projectId: "project-1",
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
    getActiveSessionId: () => "chat-1",
    getBaseUrl: () => baseUrl,
    getAuthToken: () => "token",
    getTangent: () => tangent,
    getRunDetails,
    onResourcesChanged,
  });
  return { handlers, getRunDetails, onResourcesChanged };
}

describe("createProjectCardHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.listProjectRuns.mockResolvedValue({
      items: [],
      nextPageToken: null,
    });
  });

  it("lists the card's runs, pipelines and documents, newest first", async () => {
    services.listProjectRuns.mockResolvedValue({
      items: [
        {
          id: "r-1",
          rootExecutionId: "e-1",
          pipelineName: "Train",
          createdBy: null,
          createdAt: new Date("2026-11-05T00:00:00Z"),
        },
      ],
      nextPageToken: null,
    });
    const { handlers } = setup({
      cardResources: [
        resource("res-pipeline", {
          entity: "pipeline",
          entityId: "p-1",
          name: "Train",
          createdAt: new Date("2026-11-03T00:00:00Z"),
        }),
        resource("res-old-doc", { name: "Old notes" }),
        resource("res-doc", {
          name: "Brief",
          metadata: { type: "document" },
          createdAt: new Date("2026-11-04T00:00:00Z"),
        }),
        resource("res-run", {
          name: "Attached run",
          metadata: { type: "pipeline_run", identity: "run://id/r-2" },
        }),
        resource("res-same-run", {
          name: "Train again",
          metadata: { type: "pipeline_run", identity: "run://id/r-1" },
        }),
        resource("res-instructions", {
          name: "Instructions",
          metadata: { type: "instructions" },
        }),
      ],
    });

    expect(await handlers.listEntries()).toEqual({
      runs: [
        {
          target: "run://id/r-1",
          name: "Train",
          at: new Date("2026-11-05T00:00:00Z"),
        },
        {
          target: "run://id/r-2",
          name: "Attached run",
          at: new Date("2026-11-01T00:00:00Z"),
        },
      ],
      pipelines: [
        {
          target: "pipeline://remote/p-1",
          name: "Train",
          at: new Date("2026-11-03T00:00:00Z"),
        },
      ],
      documents: [
        {
          target: "document://id/res-doc",
          name: "Brief",
          at: new Date("2026-11-04T00:00:00Z"),
        },
        {
          target: "document://id/res-old-doc",
          name: "Old notes",
          at: new Date("2026-11-01T00:00:00Z"),
        },
      ],
    });
  });

  it("archives for everyone by writing the project's metadata", async () => {
    services.getProject.mockResolvedValue({ metadata: { theme: "dark" } });
    services.updateProject.mockResolvedValue({});
    const { handlers } = setup();

    await handlers.setArchived("run://id/r-1", true);

    expect(services.updateProject).toHaveBeenCalledWith("project-1", {
      metadata: { theme: "dark", tangentArchived: ["run://id/r-1"] },
    });
  });

  it("lists every chat's files newest first, skipping a chat it can't read", async () => {
    services.listSessionFiles.mockImplementation(
      async ({ sessionId }: { sessionId: string }) => {
        if (sessionId === "chat-private") throw new Error("403");
        return [
          {
            sessionId,
            path: `artifacts/${sessionId}.md`,
            title: sessionId,
            addedAt: new Date(
              sessionId === "chat-2"
                ? "2026-11-07T00:00:00Z"
                : "2026-11-06T00:00:00Z",
            ),
            pinned: false,
          },
        ];
      },
    );
    const { handlers } = setup({
      sessionResources: [
        resource("s-1", { entity: "agent_session", entityId: "chat-1" }),
        resource("s-2", { entity: "agent_session", entityId: "chat-2" }),
        resource("s-3", { entity: "agent_session", entityId: "chat-private" }),
      ],
    });

    const files = await handlers.listFiles();

    expect(files.map(({ path }) => path)).toEqual([
      "artifacts/chat-2.md",
      "artifacts/chat-1.md",
    ]);
  });

  it("pins through Tangent with the person's token", async () => {
    const { handlers } = setup();

    await handlers.pinFile("chat-2", "artifacts/deck.html", "Deck");

    expect(services.pinSessionFile).toHaveBeenCalledWith({
      baseUrl: "https://tangent.example",
      sessionId: "chat-2",
      authToken: "token",
      path: "artifacts/deck.html",
      title: "Deck",
    });
  });

  it("dismisses a run this chat has, and only that", async () => {
    const tangent = makeTangent([hostEntry("run://id/r-1", "Train")]);
    const { handlers } = setup({ tangent });

    expect(await handlers.dismissChatRun("chat-1", "r-1")).toBe(true);
    expect(await handlers.dismissChatRun("chat-1", "r-9")).toBe(false);

    expect(tangent.addResource).toHaveBeenCalledTimes(1);
    expect(tangent.addResource).toHaveBeenCalledWith("chat-1", {
      kind: "host",
      name: "Train",
      uri: "run://id/r-1",
      meta: { dismissed: true },
    });
  });

  it("adds a run under its pipeline's name, once", async () => {
    services.createProjectResource.mockResolvedValue({ id: "res-new" });
    const { handlers, getRunDetails, onResourcesChanged } = setup({
      cardResources: [
        resource("res-run", {
          metadata: { type: "pipeline_run", identity: "run://id/r-1" },
        }),
      ],
    });

    expect(await handlers.addRun("r-1")).toEqual({
      added: false,
      target: "run://id/r-1",
    });
    expect(await handlers.addRun("r-2")).toEqual({
      added: true,
      target: "run://id/r-2",
    });

    expect(getRunDetails).toHaveBeenCalledTimes(1);
    expect(services.createProjectResource).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        name: "Train",
        metadata: { type: "pipeline_run", identity: "run://id/r-2" },
      }),
    );
    expect(onResourcesChanged).toHaveBeenCalledTimes(1);
  });

  it("adds a document and returns the target that opens it", async () => {
    services.createProjectResource.mockResolvedValue({ id: "res-doc" });
    const { handlers } = setup();

    expect(await handlers.addDocument("Brief", "Hello")).toBe(
      "document://id/res-doc",
    );
    expect(services.createProjectResource).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ name: "Brief", payload: { content: "Hello" } }),
    );
  });
});
