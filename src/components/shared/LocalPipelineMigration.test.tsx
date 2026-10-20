import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { LocalPipelinesQueryKeys } from "@/services/localPipelines/types";
import { getPipelineCreationBackendUrl } from "@/services/pipelineStorage/pipelineCreation";
import { getEditorPipelineIdentity } from "@/services/pipelineStorage/types";
import { moveLocalPipelineResourceToRemote } from "@/services/projects/moveLocalPipelineResourceToRemote";
import {
  ProjectResourcesQueryKeys,
  ProjectRunsQueryKeys,
  ProjectsQueryKeys,
} from "@/services/projects/types";

import { LocalPipelineMigration } from "./LocalPipelineMigration";

const storage = vi.hoisted(() => ({
  resolvePipeline: vi.fn(),
  moveLocalPipelineToRemote: vi.fn(),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/services/pipelineStorage/pipelineCreation", async (original) => ({
  ...(await original<
    typeof import("@/services/pipelineStorage/pipelineCreation")
  >()),
  getPipelineCreationBackendUrl: vi.fn(),
}));
vi.mock("@/providers/TourProvider/TourModeContext", () => ({
  useTourMode: vi.fn(),
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: activeBackendUrl, ready: true }),
}));
vi.mock("@/services/projects/moveLocalPipelineResourceToRemote", () => ({
  moveLocalPipelineResourceToRemote: vi.fn(),
}));

const backendUrl = "https://backend.example.com";
let activeBackendUrl = backendUrl;
const client = new QueryClient();
const onMigrated = vi.fn();
const local = {
  id: "local-id",
  storageKey: "Renamed pipeline",
  folder: { driver: { type: "root-indexdb" } },
};
const remote = {
  id: "remote-id",
  storageKey: local.storageKey,
  folder: { driver: { type: "remote-pipeline" } },
  remote: { backendUrl, pipelineId: "remote-id" },
};
const pipelineRef = { name: "Old name", fileId: local.id };

function open(projectId?: string) {
  const contents = () => (
    <StrictMode>
      <QueryClientProvider client={client}>
        <LocalPipelineMigration
          pipelineRef={pipelineRef}
          projectId={projectId}
          onMigrated={onMigrated}
        >
          <p>Local editor</p>
        </LocalPipelineMigration>
      </QueryClientProvider>
    </StrictMode>
  );
  const rendered = render(contents());
  return { ...rendered, rerender: () => rendered.rerender(contents()) };
}

beforeEach(() => {
  vi.resetAllMocks();
  activeBackendUrl = backendUrl;
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  storage.resolvePipeline.mockResolvedValue(local);
  storage.moveLocalPipelineToRemote.mockResolvedValue(remote);
  vi.mocked(getPipelineCreationBackendUrl).mockResolvedValue(backendUrl);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("uploads the resolved file once on open, before enabling edits", async () => {
  const invalidate = vi.spyOn(client, "invalidateQueries");
  open();
  expect(screen.queryByText("Local editor")).not.toBeInTheDocument();
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(storage.resolvePipeline).toHaveBeenCalledWith(pipelineRef);
  expect(storage.moveLocalPipelineToRemote).toHaveBeenCalledExactlyOnceWith(
    local,
    backendUrl,
    undefined,
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: LocalPipelinesQueryKeys.All(),
  });
});

it("keeps the local editor when the deployment selects local storage", async () => {
  vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
  open();
  await screen.findByText("Local editor");
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  expect(getPipelineCreationBackendUrl).not.toHaveBeenCalled();
});

it.each([undefined, "true"])(
  "follows one migrated local link from both projects with local storage set to %s",
  async (localStorage) => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", localStorage);
    storage.resolvePipeline.mockResolvedValue(remote);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    open("first-project");
    open("second-project");
    await waitFor(() => expect(onMigrated).toHaveBeenCalledTimes(2));
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
    expect(getPipelineCreationBackendUrl).not.toHaveBeenCalled();
    expect(moveLocalPipelineResourceToRemote).toHaveBeenCalledTimes(2);
    for (const projectId of ["first-project", "second-project"]) {
      expect(moveLocalPipelineResourceToRemote).toHaveBeenCalledWith(
        projectId,
        { id: pipelineRef.fileId, storageKey: pipelineRef.name },
        remote,
      );
    }
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: LocalPipelinesQueryKeys.All(),
    });
  },
);

it("retries a failed project repair without uploading another pipeline", async () => {
  storage.resolvePipeline.mockResolvedValue(remote);
  vi.mocked(moveLocalPipelineResourceToRemote).mockRejectedValueOnce(
    new Error("Project update failed"),
  );
  open("project-id");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Project update failed",
  );
  expect(onMigrated).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  expect(getPipelineCreationBackendUrl).not.toHaveBeenCalled();
});

it("blocks a completed migration on another backend before repairing the project", async () => {
  activeBackendUrl = "https://other.example.com";
  storage.resolvePipeline.mockResolvedValue(remote);
  open("project-id");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    `This pipeline was moved to ${backendUrl}. Select that backend in Settings to open it.`,
  );
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  expect(moveLocalPipelineResourceToRemote).not.toHaveBeenCalled();
  expect(onMigrated).not.toHaveBeenCalled();
});

it("does not reuse a cached migration after switching backends", async () => {
  storage.resolvePipeline.mockResolvedValue(remote);
  const first = open();
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  first.unmount();
  onMigrated.mockClear();
  activeBackendUrl = "https://other.example.com";
  open();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Select that backend in Settings",
  );
  expect(onMigrated).not.toHaveBeenCalled();
});

it("validates cached results before invoking the migration callback", async () => {
  activeBackendUrl = "https://other.example.com";
  client.setQueryData(
    [
      "local-pipeline-migration",
      getEditorPipelineIdentity(pipelineRef),
      undefined,
      activeBackendUrl,
    ],
    remote,
  );
  open();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Select that backend in Settings",
  );
  expect(storage.resolvePipeline).not.toHaveBeenCalled();
  expect(onMigrated).not.toHaveBeenCalled();
});

it("does not repair a project when the backend changes during migration", async () => {
  const pendingMigration = Promise.withResolvers<void>();
  storage.moveLocalPipelineToRemote.mockImplementation(
    async (_file, _backend, onCreated) => {
      await pendingMigration.promise;
      await onCreated(remote);
      return remote;
    },
  );
  const opened = open("project-id");
  await waitFor(() =>
    expect(storage.moveLocalPipelineToRemote).toHaveBeenCalled(),
  );
  activeBackendUrl = "https://other.example.com";
  storage.resolvePipeline.mockResolvedValue(remote);
  opened.rerender();
  await screen.findByRole("alert");
  await act(async () => pendingMigration.resolve());

  expect(moveLocalPipelineResourceToRemote).not.toHaveBeenCalled();
  expect(onMigrated).not.toHaveBeenCalled();
});

it("does not migrate tour scratch pipelines", () => {
  vi.mocked(useTourMode).mockReturnValue({
    tour: { id: "tour", steps: [] },
    tempPipelineName: "Tour scratch",
    promoteToPipeline: vi.fn(),
  });
  open();
  expect(screen.getByText("Local editor")).toBeInTheDocument();
  expect(storage.resolvePipeline).not.toHaveBeenCalled();
});

it("keeps external storage files in their existing editor", async () => {
  storage.resolvePipeline.mockResolvedValue({
    folder: { driver: { type: "local-filesystem" } },
  });
  open();
  await screen.findByText("Local editor");
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
});

it("reports upload failures without opening an editable local copy", async () => {
  storage.moveLocalPipelineToRemote.mockRejectedValue(
    new Error("Upload failed"),
  );
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
  expect(screen.queryByText("Local editor")).not.toBeInTheDocument();
  expect(onMigrated).not.toHaveBeenCalled();
});

it("updates the current project's association and refreshes its resources and counts", async () => {
  const projectKey = ProjectsQueryKeys.Id("project-id");
  const resourcesKey = ProjectResourcesQueryKeys.All("project-id");
  const runsKey = ProjectRunsQueryKeys.List("project-id");
  for (const key of [projectKey, resourcesKey, runsKey]) {
    client.setQueryData(key, {});
  }
  storage.moveLocalPipelineToRemote.mockImplementation(
    async (_file, _backend, onCreated) => {
      await onCreated(remote);
      return remote;
    },
  );
  open("project-id");
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(moveLocalPipelineResourceToRemote).toHaveBeenCalledExactlyOnceWith(
    "project-id",
    local,
    remote,
  );
  expect(client.getQueryState(projectKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(resourcesKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(runsKey)?.isInvalidated).toBe(false);
});
