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
import { PipelineMigrationRecoveryError } from "@/services/pipelineStorage/migrateLocalPipelineToRemote";
import { findPipelineMigration } from "@/services/pipelineStorage/pipelineMigrations";
import {
  getEditorPipelineIdentity,
  type PipelineRef,
} from "@/services/pipelineStorage/types";
import { ProjectResourcesApiError } from "@/services/projects/errors";
import { moveLocalPipelineResourceToRemote } from "@/services/projects/moveLocalPipelineResourceToRemote";
import {
  ProjectResourcesQueryKeys,
  ProjectsQueryKeys,
} from "@/services/projects/types";

import { LocalPipelineMigration } from "./LocalPipelineMigration";

const { storage, notify } = vi.hoisted(() => ({
  storage: { resolvePipeline: vi.fn(), moveLocalPipelineToRemote: vi.fn() },
  notify: vi.fn(),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/services/pipelineStorage/pipelineMigrations", async (original) => ({
  ...(await original<
    typeof import("@/services/pipelineStorage/pipelineMigrations")
  >()),
  findPipelineMigration: vi.fn(),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
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
const consentKey = `local-pipeline-migration-consent-v1:${backendUrl}`;

function open(projectId?: string, ref: PipelineRef = pipelineRef) {
  const contents = () => (
    <StrictMode>
      <QueryClientProvider client={client}>
        <LocalPipelineMigration
          pipelineRef={ref}
          projectId={projectId}
          onMigrated={onMigrated}
        >
          <p>Local editor</p>
        </LocalPipelineMigration>
      </QueryClientProvider>
    </StrictMode>
  );
  const view = render(contents());
  return { ...view, rerender: () => view.rerender(contents()) };
}

beforeEach(() => {
  vi.resetAllMocks();
  activeBackendUrl = backendUrl;
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  localStorage.clear();
  localStorage.setItem(consentKey, "true");
  storage.resolvePipeline.mockResolvedValue(local);
  storage.moveLocalPipelineToRemote.mockResolvedValue(remote);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("asks before uploading and cancellation opens the unchanged local editor", async () => {
  localStorage.removeItem(consentKey);
  open();
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(backendUrl);
  expect(dialog).toHaveTextContent("Other users with read access");
  expect(dialog).toHaveTextContent("configured input values");
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByText("Local editor");
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
});

it("uploads only after confirmation when consent was not remembered", async () => {
  localStorage.removeItem(consentKey);
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(storage.moveLocalPipelineToRemote).toHaveBeenCalledExactlyOnceWith(
    local,
    backendUrl,
    undefined,
  );
});

it("does not reuse consent granted to a different backend", async () => {
  activeBackendUrl = "https://other.example.com";
  open();
  expect(await screen.findByRole("alertdialog")).toHaveTextContent(
    activeBackendUrl,
  );
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
});

it("uses the active backend and remembered consent without reading other-tab settings", async () => {
  open();
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(storage.moveLocalPipelineToRemote).toHaveBeenCalledExactlyOnceWith(
    local,
    backendUrl,
    undefined,
  );
});

it.each(["deployment", "unconfigured", "external"])(
  "opens local storage for %s",
  async (mode) => {
    if (mode === "deployment") vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
    if (mode === "unconfigured") activeBackendUrl = "";
    if (mode === "external")
      storage.resolvePipeline.mockResolvedValue({
        ...local,
        folder: { driver: { type: "local-filesystem" } },
      });
    open();
    await screen.findByText("Local editor");
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  },
);

it("keeps local editing available on upload failure and offers a retry", async () => {
  storage.moveLocalPipelineToRemote.mockRejectedValueOnce(
    new Error("Write permission denied"),
  );
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Write permission denied",
  );
  expect(screen.getByText("Local editor")).toBeInTheDocument();
  expect(onMigrated).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry upload" }));
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
});

it("opens the saved remote copy with a warning after finalization fails", async () => {
  storage.resolvePipeline.mockResolvedValueOnce(remote);
  const saved = await storage.resolvePipeline();
  storage.resolvePipeline.mockResolvedValue(local);
  storage.moveLocalPipelineToRemote.mockRejectedValue(
    new PipelineMigrationRecoveryError(
      "Project links need repair; local copy kept",
      saved,
    ),
  );
  open();
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(notify).toHaveBeenCalledWith(
    "Project links need repair; local copy kept",
    "warning",
  );
  expect(screen.queryByText("Local editor")).not.toBeInTheDocument();
});

it("keeps changed local content available for recovery after upload", async () => {
  storage.resolvePipeline.mockResolvedValueOnce(remote);
  const saved = await storage.resolvePipeline();
  storage.resolvePipeline.mockResolvedValue(local);
  storage.moveLocalPipelineToRemote.mockRejectedValue(
    new PipelineMigrationRecoveryError(
      "Both copies were kept.",
      saved,
      undefined,
      true,
    ),
  );
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "recover your edits",
  );
  expect(screen.getByText("Local editor")).toBeInTheDocument();
  expect(onMigrated).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Open uploaded pipeline" }),
  );
  expect(onMigrated).toHaveBeenCalledWith(remote);
});

it.each([403, 404])(
  "opens an existing remote pipeline when its former project returns %s",
  async (status) => {
    storage.resolvePipeline.mockResolvedValue(remote);
    vi.mocked(moveLocalPipelineResourceToRemote).mockRejectedValue(
      new ProjectResourcesApiError("Project unavailable", status),
    );
    open("deleted-project");
    await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote, true));
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("former project is no longer available"),
      "warning",
    );
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  },
);

it("uses the recorded local ID when repairing a migrated name-only link", async () => {
  storage.resolvePipeline.mockResolvedValue(remote);
  vi.mocked(findPipelineMigration).mockResolvedValue({
    key: "name:Old name",
    localId: local.id,
    name: remote.storageKey,
    remote: { source: "remote", ...remote.remote },
  });
  open("project-id", { name: "Old name", fileId: undefined });
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(moveLocalPipelineResourceToRemote).toHaveBeenCalledWith(
    "project-id",
    { id: local.id, storageKey: "Old name" },
    remote,
    backendUrl,
  );
});

it("invalidates project lists as well as the project detail and resources", async () => {
  storage.resolvePipeline.mockResolvedValue(remote);
  const keys = [
    ProjectsQueryKeys.List(),
    ProjectsQueryKeys.Id("project-id"),
    ProjectResourcesQueryKeys.All("project-id"),
  ];
  keys.forEach((key) => client.setQueryData(key, {}));
  open("project-id");
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  keys.forEach((key) =>
    expect(client.getQueryState(key)?.isInvalidated).toBe(true),
  );
});

it("waits for a cached local file to be re-resolved before starting migration", async () => {
  client.setQueryData(
    [
      "local-pipeline-migration",
      getEditorPipelineIdentity(pipelineRef),
      undefined,
      backendUrl,
    ],
    local,
  );
  const pending = Promise.withResolvers<typeof remote>();
  storage.resolvePipeline.mockReturnValue(pending.promise);
  open();
  expect(screen.getByRole("status")).toHaveTextContent("Opening pipeline");
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  await act(async () => pending.resolve(remote));
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
});

it("rejects a cached migration from a different backend before navigation", async () => {
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
  storage.resolvePipeline.mockResolvedValue(remote);
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Select that backend in Settings",
  );
  expect(onMigrated).not.toHaveBeenCalled();
});

it("lets a pending move finish on its captured backend without navigating after a switch", async () => {
  const pending = Promise.withResolvers<void>();
  storage.moveLocalPipelineToRemote.mockImplementation(
    async (_file, _backend, repair) => {
      await pending.promise;
      await repair(remote);
      return remote;
    },
  );
  const view = open("project-id");
  await waitFor(() =>
    expect(storage.moveLocalPipelineToRemote).toHaveBeenCalled(),
  );
  activeBackendUrl = "https://other.example.com";
  storage.resolvePipeline.mockResolvedValue(remote);
  view.rerender();
  await screen.findByRole("alert");
  await act(async () => pending.resolve());
  expect(moveLocalPipelineResourceToRemote).toHaveBeenCalledWith(
    "project-id",
    { id: local.id, storageKey: pipelineRef.name },
    remote,
    backendUrl,
  );
  expect(onMigrated).not.toHaveBeenCalled();
});

it("announces the pending operation", async () => {
  storage.moveLocalPipelineToRemote.mockReturnValue(new Promise(() => {}));
  open();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Opening pipeline",
  );
});

it("does not resolve or migrate tour scratch pipelines", () => {
  vi.mocked(useTourMode).mockReturnValue({
    tour: { id: "tour", steps: [] },
    tempPipelineName: "Tour",
    promoteToPipeline: vi.fn(),
  });
  open();
  expect(screen.getByText("Local editor")).toBeInTheDocument();
  expect(storage.resolvePipeline).not.toHaveBeenCalled();
});
