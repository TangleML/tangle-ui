import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { startingSessionMetadata } from "@/services/projects/startingSession";
import type {
  Project,
  ProjectResourceSummary,
} from "@/services/projects/types";
import { useProjectResources } from "@/services/projects/useProjectResources";
import { useProject } from "@/services/projects/useProjects";

import { usePrepareProjectArrival } from "./usePrepareProjectArrival";

const navigate = vi.fn();
const notify = vi.fn();
let search: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useSearch: () => search,
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/useAiProviderSettings", () => ({
  useAiProviderSettings: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
  useUpdateProject: () => ({ mutateAsync: updateProject }),
}));

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResources: vi.fn(),
  useCreateProjectResource: () => ({ mutateAsync: createResource }),
}));

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows }),
}));

vi.mock(
  "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions",
  () => ({ createNewPipeline: vi.fn() }),
);

const updateProject = vi.fn();
const createResource = vi.fn();
const deleteFile = vi.fn();
const storage = {};
const minimize = vi.fn();
const windows = { getWindowById: vi.fn(() => ({ minimize })) };

const project = {
  id: "project-1",
  name: "Churn model",
  metadata: null,
} as unknown as Project;

function document(
  metadata: Record<string, unknown> | null,
  createdAt = "2026-09-21T10:00:00Z",
): ProjectResourceSummary {
  return {
    id: `resource-${createdAt}`,
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    metadata,
    createdBy: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

function makeStore() {
  return {
    isStartingSession: false,
    startSession: vi.fn().mockResolvedValue(true),
    openWorkareaTarget: vi.fn().mockResolvedValue(undefined),
  } as unknown as TangentProjectStore;
}

function given({
  projectOverrides = {},
  documents = [] as ProjectResourceSummary[],
}: {
  projectOverrides?: Partial<Project>;
  documents?: ProjectResourceSummary[];
} = {}) {
  vi.mocked(useProject).mockReturnValue({
    data: { ...project, ...projectOverrides },
  } as unknown as ReturnType<typeof useProject>);
  vi.mocked(useProjectResources).mockReturnValue({
    data: { items: documents },
  } as unknown as ReturnType<typeof useProjectResources>);
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve)));

function prepare(store: TangentProjectStore, sessionCount = 0) {
  return renderHook(
    () =>
      usePrepareProjectArrival(store, {
        projectId: "project-1",
        sessionCount,
        isSessionsLoading: false,
      }),
    { wrapper },
  );
}

function mockAiConfigured(isConfigured: boolean) {
  vi.mocked(useAiProviderSettings).mockReturnValue({
    isConfigured,
  } as unknown as ReturnType<typeof useAiProviderSettings>);
}

describe("usePrepareProjectArrival", () => {
  beforeEach(() => {
    search = {};
    given();
    mockAiConfigured(true);
    windows.getWindowById.mockReturnValue({ minimize });
    vi.mocked(createNewPipeline).mockResolvedValue({
      id: "file-1",
      storageKey: "Churn model",
      deleteFile,
    } as unknown as Awaited<ReturnType<typeof createNewPipeline>>);
  });
  afterEach(() => vi.resetAllMocks());

  /** An empty project's window is a tall empty form above what someone came for. */
  it("folds the project window away on a project nobody has worked in", async () => {
    const store = makeStore();

    prepare(store);

    await waitFor(() => expect(minimize).toHaveBeenCalledTimes(1));
    expect(windows.getWindowById).toHaveBeenCalledWith(
      "tangent-project-details",
    );
  });

  it("leaves the project window as it was found on a project with a session", async () => {
    const store = makeStore();

    prepare(store, 1);
    await settle();

    expect(minimize).not.toHaveBeenCalled();
  });

  it("does not fold it away when the session could not start", async () => {
    const store = makeStore();
    vi.mocked(store.startSession).mockResolvedValue(false);

    prepare(store);
    await settle();

    expect(minimize).not.toHaveBeenCalled();
  });

  it("starts a session for a project that has none", async () => {
    const store = makeStore();

    prepare(store);

    await waitFor(() => expect(store.startSession).toHaveBeenCalledTimes(1));
    expect(store.startSession).toHaveBeenCalledWith(undefined);
  });

  /**
   * The opening prompt is spent on the session it starts, so starting one
   * nobody can answer would burn it and leave a dead thread behind.
   */
  it("starts nothing without an AI provider", async () => {
    mockAiConfigured(false);
    const store = makeStore();

    prepare(store);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.startSession).not.toHaveBeenCalled();
    expect(createNewPipeline).not.toHaveBeenCalled();
  });

  it("creates a pipeline the ordinary way and attaches it", async () => {
    const store = makeStore();

    prepare(store);

    await waitFor(() => expect(createNewPipeline).toHaveBeenCalled());
    expect(createNewPipeline).toHaveBeenCalledWith(storage, undefined, {
      provisionalName: true,
      onRemoteCreated: expect.any(Function),
    });
    expect(createResource).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "document", name: "Churn model" }),
    );
  });

  it("opens the pipeline it created", async () => {
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.openWorkareaTarget).toHaveBeenCalledWith(
        { type: "pipeline", identity: "id/file-1" },
        "Churn model",
      ),
    );
  });

  it("opens a remote draft without attaching an empty pipeline", async () => {
    vi.mocked(createNewPipeline).mockResolvedValue({
      id: "draft-1",
      initialId: "draft-1",
      storageKey: "Churn model",
      isDraft: true,
    } as Awaited<ReturnType<typeof createNewPipeline>>);
    const store = makeStore();
    prepare(store);
    await waitFor(() =>
      expect(store.openWorkareaTarget).toHaveBeenCalledWith(
        { type: "pipeline", identity: "draft/draft-1" },
        "Churn model",
      ),
    );
    expect(createResource).not.toHaveBeenCalled();
  });

  it("reopens an attached remote pipeline instead of creating another", async () => {
    given({
      documents: [
        { ...document(null), entity: "pipeline", entityId: "remote-1" },
      ],
    });
    const store = makeStore();
    prepare(store);
    await waitFor(() =>
      expect(store.openWorkareaTarget).toHaveBeenCalledWith(
        { type: "pipeline", identity: "remote/remote-1" },
        "Churn model",
      ),
    );
    expect(createNewPipeline).not.toHaveBeenCalled();
    expect(createResource).not.toHaveBeenCalled();
  });

  /** The workarea is keyed by session, so a tab opened before one is dropped. */
  it("opens the pipeline only once a session is running", async () => {
    const store = makeStore();
    let sessionStarted = false;
    vi.mocked(store.startSession).mockImplementation(async () => {
      sessionStarted = true;
      return true;
    });
    vi.mocked(store.openWorkareaTarget).mockImplementation(async () => {
      expect(sessionStarted).toBe(true);
      return undefined as never;
    });

    prepare(store);

    await waitFor(() => expect(store.openWorkareaTarget).toHaveBeenCalled());
  });

  it("leaves a project that already has a session alone", async () => {
    const store = makeStore();

    prepare(store, 1);
    await settle();

    expect(store.startSession).not.toHaveBeenCalled();
    expect(createNewPipeline).not.toHaveBeenCalled();
  });

  /**
   * Debug in Tangent asks for a session in whichever project the failed run
   * belongs to, which is usually one somebody has already worked in.
   */
  it("still starts the session a busy project was asked for", async () => {
    given({
      projectOverrides: {
        metadata: startingSessionMetadata({ prompt: "Fix run 7" }),
      },
    });
    const store = makeStore();

    prepare(store, 2);

    await waitFor(() =>
      expect(store.startSession).toHaveBeenCalledWith({
        prompt: "Fix run 7",
        name: "Fix run 7",
      }),
    );
    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith({
        id: "project-1",
        input: { metadata: {} },
      }),
    );
  });

  /**
   * An ask left on the project and never arrived for would otherwise open
   * whichever session is started there next, days later or by someone else.
   */
  it("leaves an ask nobody arrived for within the hour unsent", async () => {
    given({
      projectOverrides: {
        metadata: {
          startingPrompt: "hello world",
          startingRequestedAt: "2026-10-14T23:06:36Z",
        },
      },
    });
    const store = makeStore();

    prepare(store, 2);
    await settle();

    expect(store.startSession).not.toHaveBeenCalled();
    expect(updateProject).not.toHaveBeenCalled();
  });

  /** Somebody is working in it: it is not theirs to rearrange. */
  it("leaves a busy project's window and pipelines as they are", async () => {
    given({
      projectOverrides: {
        metadata: startingSessionMetadata({ prompt: "Fix run 7" }),
      },
    });
    const store = makeStore();

    prepare(store, 2);
    await waitFor(() => expect(store.startSession).toHaveBeenCalled());
    await settle();

    expect(minimize).not.toHaveBeenCalled();
    expect(createNewPipeline).not.toHaveBeenCalled();
    expect(store.openWorkareaTarget).not.toHaveBeenCalled();
  });

  /**
   * An Open in Tangent project holds the run and no pipeline, and its untouched
   * session is gone again the next time someone arrives.
   */
  it("opens the run a project holds when it has no pipeline", async () => {
    given({
      documents: [
        document({ type: "pipeline_run", identity: "run://id/run-7" }),
      ],
    });
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.openWorkareaTarget).toHaveBeenCalledWith(
        { type: "run", identity: "id/run-7" },
        "Churn model",
      ),
    );
    expect(createNewPipeline).not.toHaveBeenCalled();
  });

  it("opens the pipeline a project already has rather than adding another", async () => {
    given({
      documents: [
        document({ type: "local_pipeline", identity: "pipeline://id/file-7" }),
      ],
    });
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.openWorkareaTarget).toHaveBeenCalledWith(
        { type: "pipeline", identity: "id/file-7" },
        "Churn model",
      ),
    );
    expect(createNewPipeline).not.toHaveBeenCalled();
    expect(createResource).not.toHaveBeenCalled();
  });

  /** A pipeline cloned from a run has no registry row, so it is named, not id'd. */
  it("recognises a pipeline addressed by name rather than by id", async () => {
    given({
      documents: [
        document({
          type: "local_pipeline",
          storage: "browser",
          identity: "pipeline://name/Cloned from run 42",
          fallbackName: "Cloned from run 42",
        }),
      ],
    });
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.openWorkareaTarget).toHaveBeenCalledWith(
        { type: "pipeline", identity: "name/Cloned from run 42" },
        "Churn model",
      ),
    );
    expect(createNewPipeline).not.toHaveBeenCalled();
  });

  it("ignores documents that are not pipelines", async () => {
    given({ documents: [document({ type: "notes" })] });
    const store = makeStore();

    prepare(store);

    await waitFor(() => expect(createNewPipeline).toHaveBeenCalled());
  });

  it("opens the oldest pipeline when the project has several", async () => {
    given({
      documents: [
        document(
          { type: "local_pipeline", identity: "pipeline://id/newer" },
          "2026-09-20T10:00:00Z",
        ),
        document(
          { type: "local_pipeline", identity: "pipeline://id/older" },
          "2026-09-02T10:00:00Z",
        ),
      ],
    });
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.openWorkareaTarget).toHaveBeenCalledWith(
        { type: "pipeline", identity: "id/older" },
        "Churn model",
      ),
    );
  });

  it("still opens with the prompt a debug project carries, and clears it", async () => {
    given({
      projectOverrides: {
        metadata: startingSessionMetadata({ prompt: "Fix run 7" }),
      },
    });
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.startSession).toHaveBeenCalledWith({
        prompt: "Fix run 7",
        name: "Fix run 7",
      }),
    );
    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith({
        id: "project-1",
        input: { metadata: {} },
      }),
    );
  });

  /**
   * The session the prompt asked for has already started by then, so a refusal
   * must not cost the caller the pipeline and the workarea they came for.
   */
  it("still opens the workarea when the prompt cannot be cleared", async () => {
    given({
      projectOverrides: {
        metadata: startingSessionMetadata({ prompt: "Fix run 7" }),
      },
    });
    updateProject.mockRejectedValueOnce(new Error("conflict"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = makeStore();

    prepare(store);

    await waitFor(() => expect(store.openWorkareaTarget).toHaveBeenCalled());
  });

  /**
   * Nothing lists a pipeline by the project it is not attached to, so one left
   * behind here is invisible as well as unasked for.
   */
  it("removes the pipeline again when the project refuses it", async () => {
    createResource.mockRejectedValueOnce(new Error("refused"));
    const store = makeStore();

    prepare(store);

    await waitFor(() => expect(deleteFile).toHaveBeenCalled());
    expect(store.openWorkareaTarget).not.toHaveBeenCalled();
  });

  /** All three are what the prompt asked for, so all three say so. */
  it("names the session and the pipeline it opens after the prompt", async () => {
    given({
      projectOverrides: {
        metadata: startingSessionMetadata({
          prompt: "Can you build a churn model for Q3",
        }),
      },
    });
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.startSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Build a churn model for Q3" }),
      ),
    );
    await waitFor(() =>
      expect(createNewPipeline).toHaveBeenCalledWith(
        storage,
        "Build a churn model for Q3",
        { provisionalName: true, onRemoteCreated: expect.any(Function) },
      ),
    );
  });

  it("does nothing until it knows what the project holds", async () => {
    vi.mocked(useProjectResources).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useProjectResources>);
    const store = makeStore();

    prepare(store);
    await settle();

    expect(store.startSession).not.toHaveBeenCalled();
  });

  it("prepares once however often it re-renders", async () => {
    const store = makeStore();

    const { rerender } = prepare(store);
    rerender();
    rerender();
    await settle();

    expect(store.startSession).toHaveBeenCalledTimes(1);
    expect(createNewPipeline).toHaveBeenCalledTimes(1);
    expect(createResource).toHaveBeenCalledTimes(1);
  });

  it("does not go on to a pipeline when the session could not start", async () => {
    const store = makeStore();
    vi.mocked(store.startSession).mockResolvedValue(false);

    prepare(store);
    await settle();

    expect(store.startSession).toHaveBeenCalled();
    expect(createNewPipeline).not.toHaveBeenCalled();
    expect(store.openWorkareaTarget).not.toHaveBeenCalled();
  });

  describe("asked for by the link", () => {
    it("starts a session on a project that already has some", async () => {
      search = { session: "new" };
      const store = makeStore();

      prepare(store, 2);

      await waitFor(() => expect(store.startSession).toHaveBeenCalledTimes(1));
      expect(store.startSession).toHaveBeenCalledWith(undefined);
    });

    it("opens the view it names in the session it starts", async () => {
      search = { session: "new", open: "run://id/run-7" };
      const store = makeStore();

      prepare(store, 2);

      await waitFor(() =>
        expect(store.openWorkareaTarget).toHaveBeenCalledWith({
          type: "run",
          identity: "id/run-7",
        }),
      );
      expect(
        vi.mocked(store.startSession).mock.invocationCallOrder[0],
      ).toBeLessThan(
        vi.mocked(store.openWorkareaTarget).mock.invocationCallOrder[0],
      );
    });

    it("opens that view instead of giving an empty project a pipeline", async () => {
      search = { open: "run://id/run-7" };
      const store = makeStore();

      prepare(store);

      await waitFor(() =>
        expect(store.openWorkareaTarget).toHaveBeenCalledWith({
          type: "run",
          identity: "id/run-7",
        }),
      );
      expect(store.startSession).toHaveBeenCalledTimes(1);
      expect(createNewPipeline).not.toHaveBeenCalled();
      expect(minimize).toHaveBeenCalled();
    });

    it("says why the view it names could not be opened", async () => {
      search = { open: "run://id/run-7" };
      const store = makeStore();
      vi.mocked(store.openWorkareaTarget).mockRejectedValue(
        new Error("Run run-7 was not found"),
      );

      prepare(store);

      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith("Run run-7 was not found", "error"),
      );
    });

    it("opens it alongside the prompt a debug project carries", async () => {
      search = { open: "run://id/run-7" };
      given({
        projectOverrides: {
          metadata: startingSessionMetadata({
            prompt: "Find out why run-7 failed.",
          }),
        },
      });
      const store = makeStore();

      prepare(store, 1);

      await waitFor(() =>
        expect(store.openWorkareaTarget).toHaveBeenCalledWith({
          type: "run",
          identity: "id/run-7",
        }),
      );
      expect(store.startSession).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "Find out why run-7 failed." }),
      );
    });

    it("opens a requested run in a populated remote project and clears a waiting prompt", async () => {
      search = { session: "new", open: "run://id/run-7" };
      given({
        documents: [
          { ...document(null), entity: "pipeline", entityId: "remote-1" },
        ],
        projectOverrides: {
          metadata: startingSessionMetadata({
            prompt: "Find out why run-3 failed.",
          }),
        },
      });
      const store = makeStore();

      prepare(store, 2);

      await waitFor(() =>
        expect(store.openWorkareaTarget).toHaveBeenCalledWith({
          type: "run",
          identity: "id/run-7",
        }),
      );
      expect(store.openWorkareaTarget).toHaveBeenCalledTimes(1);
      expect(store.startSession).toHaveBeenCalledTimes(1);
      expect(store.startSession).toHaveBeenCalledWith(undefined);
      expect(updateProject).toHaveBeenCalledWith({
        id: "project-1",
        input: { metadata: {} },
      });
      expect(createNewPipeline).not.toHaveBeenCalled();
      expect(createResource).not.toHaveBeenCalled();
      expect(minimize).not.toHaveBeenCalled();
    });

    it("waits for a cached project to be read again before deciding", async () => {
      search = { open: "run://id/run-7" };
      navigate.mockImplementation(({ search: rewrite }) => {
        search = rewrite(search);
      });
      vi.mocked(useProject).mockReturnValue({
        data: project,
        isFetching: true,
      } as unknown as ReturnType<typeof useProject>);
      const store = makeStore();

      const { rerender } = prepare(store, 2);
      await settle();
      given({
        projectOverrides: {
          metadata: startingSessionMetadata({
            prompt: "Find out why run-7 failed.",
          }),
        },
      });
      rerender();

      await waitFor(() =>
        expect(store.openWorkareaTarget).toHaveBeenCalledWith({
          type: "run",
          identity: "id/run-7",
        }),
      );
      expect(store.startSession).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "Find out why run-7 failed." }),
      );
    });

    /** Left in the url, a reload would start a second session. */
    it("is taken back out of the url once acted on", async () => {
      search = { session: "new", open: "run://id/run-7", other: "kept" };

      prepare(makeStore(), 2);

      await waitFor(() => expect(navigate).toHaveBeenCalled());
      const { search: rewrite, replace } = navigate.mock.calls[0][0];
      expect(replace).toBe(true);
      expect(rewrite(search)).toEqual({ other: "kept" });
    });

    it("drops a view from the url when nothing will open it", async () => {
      search = { open: "run://id/run-7", other: "kept" };
      const store = makeStore();

      prepare(store, 2);

      await waitFor(() => expect(navigate).toHaveBeenCalled());
      const { search: rewrite, replace } = navigate.mock.calls[0][0];
      expect(replace).toBe(true);
      expect(rewrite(search)).toEqual({ other: "kept" });
      expect(store.startSession).not.toHaveBeenCalled();
      expect(store.openWorkareaTarget).not.toHaveBeenCalled();
    });

    it("keeps a view for an arrival still waiting on an AI provider", async () => {
      mockAiConfigured(false);
      search = { open: "run://id/run-7" };

      prepare(makeStore());

      await settle();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("leaves a url that asks for nothing alone", async () => {
      prepare(makeStore());

      await settle();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("waits for an AI provider before acting on it", async () => {
      mockAiConfigured(false);
      search = { session: "new" };
      const store = makeStore();

      prepare(store, 2);

      await settle();
      expect(store.startSession).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
