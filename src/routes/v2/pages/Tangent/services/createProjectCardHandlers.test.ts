import type { EmbedResource, Tangent } from "@tangent/embed-react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ListProjectResourcesParams,
  ProjectResourceSummary,
} from "@/services/projects/types";

import {
  createProjectCardHandlers,
  type PipelineLookups,
} from "./createProjectCardHandlers";

const services = vi.hoisted(() => ({
  listProjectResources: vi.fn(),
  createProjectResource: vi.fn(),
  listProjectRuns: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
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

function entry(
  kind: EmbedResource["kind"],
  uri: string,
  name: string,
  createdAt = "2026-11-05T10:00:00.000Z",
): EmbedResource {
  return { id: uri, sessionId: "chat-1", kind, name, uri, createdAt };
}

function makeTangent(
  resourcesOf: (sessionId: string) => EmbedResource[],
): Tangent {
  return {
    newSession: vi.fn(),
    listResources: vi.fn(async (sessionId: string) => resourcesOf(sessionId)),
    addResource: vi.fn().mockResolvedValue(undefined),
    removeResource: vi.fn(),
  };
}

const NOTHING_KNOWN: PipelineLookups = {
  localPipelines: { unavailable: new Set(), currentNames: new Map() },
  remotePipelineNames: new Map(),
};

function setup({
  cardResources = [],
  sessionResources = [],
  tangent = makeTangent(() => []),
  baseUrl = "https://tangent.example",
  pipelineLookups = NOTHING_KNOWN,
}: {
  cardResources?: ProjectResourceSummary[];
  sessionResources?: ProjectResourceSummary[];
  tangent?: Tangent;
  baseUrl?: string;
  pipelineLookups?: PipelineLookups;
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
    getPipelineLookups: () => pipelineLookups,
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
    services.getProject.mockResolvedValue({ metadata: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists the card's runs, pipelines and documents, newest first, saying which are archived", async () => {
    services.getProject.mockResolvedValue({
      metadata: { tangentArchived: ["document://id/res-old-doc"] },
    });
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
          archived: false,
        },
        {
          target: "run://id/r-2",
          name: "Attached run",
          at: new Date("2026-11-01T00:00:00Z"),
          archived: false,
        },
      ],
      pipelines: [
        {
          target: "pipeline://remote/p-1",
          name: "Train",
          at: new Date("2026-11-03T00:00:00Z"),
          archived: false,
        },
      ],
      documents: [
        {
          target: "document://id/res-doc",
          name: "Brief",
          at: new Date("2026-11-04T00:00:00Z"),
          archived: false,
        },
        {
          target: "document://id/res-old-doc",
          name: "Old notes",
          at: new Date("2026-11-01T00:00:00Z"),
          archived: true,
        },
      ],
    });
  });

  it("leaves out a pipeline this browser can't open, and names one by what it's called now", async () => {
    const local = (id: string, name: string) =>
      resource(id, {
        name,
        metadata: {
          type: "local_pipeline",
          storage: "browser",
          identity: `pipeline://name/${name}`,
          fallbackName: name,
        },
      });
    const { handlers } = setup({
      cardResources: [local("res-theirs", "Theirs"), local("res-mine", "Mine")],
      pipelineLookups: {
        localPipelines: {
          unavailable: new Set(["res-theirs"]),
          currentNames: new Map([["res-mine", "Mine, renamed"]]),
        },
        remotePipelineNames: new Map(),
      },
    });

    const { pipelines } = await handlers.listEntries();

    expect(pipelines.map(({ name }) => name)).toEqual(["Mine, renamed"]);
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
    const tangent = makeTangent((sessionId) => {
      if (sessionId === "chat-private") throw new Error("403");
      return [
        entry(
          "file",
          `artifacts/${sessionId}.md`,
          sessionId,
          sessionId === "chat-2"
            ? "2026-11-07T00:00:00Z"
            : "2026-11-06T00:00:00Z",
        ),
      ];
    });
    const { handlers } = setup({
      tangent,
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
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const { handlers } = setup();

    await handlers.pinFile("chat-2", "artifacts/deck.html", "Deck");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tangent.example/api/sessions/chat-2/pins",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
        body: JSON.stringify({ path: "artifacts/deck.html", title: "Deck" }),
      }),
    );
  });

  it("dismisses a run this chat has, and only that", async () => {
    const tangent = makeTangent(() => [entry("host", "run://id/r-1", "Train")]);
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

  it("won't add a run that doesn't exist, even under a name", async () => {
    const { handlers, getRunDetails } = setup({ cardResources: [] });
    getRunDetails.mockRejectedValue(new Error("Run not-a-run not found"));

    await expect(handlers.addRun("not-a-run", "Train")).rejects.toThrow(
      /not found/,
    );
    expect(services.createProjectResource).not.toHaveBeenCalled();
  });

  it("adds a run under the name it's given", async () => {
    services.createProjectResource.mockResolvedValue({ id: "res-new" });
    const { handlers } = setup({ cardResources: [] });

    await handlers.addRun("r-2", "Nightly train");

    expect(services.createProjectResource).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ name: "Nightly train" }),
    );
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
