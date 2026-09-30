import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";
import type {
  Project,
  ProjectResourceSummary,
} from "@/services/projects/types";
import { useProjectResources } from "@/services/projects/useProjectResources";
import { useProject } from "@/services/projects/useProjects";

import { usePrepareEmptyProject } from "./usePrepareEmptyProject";

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

vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  availablePipelineName: vi.fn(),
}));

vi.mock(
  "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions",
  () => ({ createNewPipeline: vi.fn() }),
);

const updateProject = vi.fn();
const createResource = vi.fn();
const storage = {};
const minimize = vi.fn();
const windows = { getWindowById: vi.fn(() => ({ minimize })) };

const project = {
  id: "project-1",
  name: "Churn model",
  extraData: null,
} as unknown as Project;

function document(
  extraData: Record<string, unknown> | null,
  createdAt = "2026-09-21T10:00:00Z",
): ProjectResourceSummary {
  return {
    id: `resource-${createdAt}`,
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    extraData,
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
      usePrepareEmptyProject(store, {
        projectId: "project-1",
        sessionCount,
        isSessionsLoading: false,
      }),
    { wrapper },
  );
}

describe("usePrepareEmptyProject", () => {
  beforeEach(() => {
    given();
    windows.getWindowById.mockReturnValue({ minimize });
    vi.mocked(availablePipelineName).mockResolvedValue("Churn model");
    vi.mocked(createNewPipeline).mockResolvedValue({
      id: "file-1",
      storageKey: "Churn model",
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

  it("creates a pipeline named after the project and attaches it", async () => {
    const store = makeStore();

    prepare(store);

    await waitFor(() => expect(createNewPipeline).toHaveBeenCalled());
    expect(availablePipelineName).toHaveBeenCalledWith("Churn model");
    expect(createNewPipeline).toHaveBeenCalledWith(storage, "Churn model");
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
    given({ projectOverrides: { extraData: { startingPrompt: "Fix run 7" } } });
    const store = makeStore();

    prepare(store);

    await waitFor(() =>
      expect(store.startSession).toHaveBeenCalledWith({
        prompt: "Fix run 7",
        name: "Debug session",
      }),
    );
    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith({
        id: "project-1",
        input: { extraData: {} },
      }),
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
});
