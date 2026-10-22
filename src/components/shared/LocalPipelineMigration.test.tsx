import "fake-indexeddb/auto";

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
import { pipelineStorageDb } from "@/services/pipelineStorage/db";
import { PipelineMigrationRecoveryError } from "@/services/pipelineStorage/migrateLocalPipelineToRemote";
import { revokePipelineMigrationConsent } from "@/services/pipelineStorage/pipelineMigrationConsent";
import {
  findPipelineMigration,
  PipelineMovedToBackendError,
} from "@/services/pipelineStorage/pipelineMigrations";
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
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";

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
vi.mock("@/services/remotePipelineEditorService", () => ({
  getRemotePipelineWriter: vi.fn(),
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

beforeEach(async () => {
  await pipelineStorageDb.pipeline_migration_attempts.clear();
  vi.resetAllMocks();
  activeBackendUrl = backendUrl;
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  localStorage.clear();
  localStorage.setItem(consentKey, "true");
  storage.resolvePipeline.mockResolvedValue(local);
  storage.moveLocalPipelineToRemote.mockResolvedValue(remote);
  vi.mocked(getRemotePipelineWriter).mockResolvedValue("writer");
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
  fireEvent.click(await screen.findByRole("button", { name: "Move" }));
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(storage.moveLocalPipelineToRemote).toHaveBeenCalledExactlyOnceWith(
    local,
    backendUrl,
    undefined,
  );
});

it.each([false, true])(
  "keeps inactive tabs from prompting or uploading (remembered: %s)",
  async (remembered) => {
    if (!remembered) localStorage.removeItem(consentKey);
    const view = (active: boolean) => (
      <QueryClientProvider client={client}>
        <LocalPipelineMigration
          pipelineRef={pipelineRef}
          isActive={active}
          onMigrated={onMigrated}
        >
          <p>Local editor</p>
        </LocalPipelineMigration>
      </QueryClientProvider>
    );
    const { rerender } = render(view(false));
    await waitFor(() => expect(storage.resolvePipeline).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
    expect(getRemotePipelineWriter).not.toHaveBeenCalled();
    rerender(view(true));
    if (remembered)
      await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
    else expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  },
);

it("opens the local editor without offering a move when writing is unavailable", async () => {
  vi.mocked(getRemotePipelineWriter).mockRejectedValue(
    new Error("Write permission denied"),
  );
  open();
  await screen.findByText("Local editor");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
});

it("waits for write permission before opening or moving an eligible local file", async () => {
  const permission = Promise.withResolvers<string>();
  vi.mocked(getRemotePipelineWriter).mockReturnValue(permission.promise);
  open();
  await waitFor(() => expect(getRemotePipelineWriter).toHaveBeenCalled());
  expect(screen.queryByText("Local editor")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  await act(async () => permission.resolve("writer"));
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
});

it("opens an existing remote alias without requiring write permission", async () => {
  storage.resolvePipeline.mockResolvedValue(remote);
  vi.mocked(getRemotePipelineWriter).mockRejectedValue(
    new Error("Write permission denied"),
  );
  open();
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(getRemotePipelineWriter).not.toHaveBeenCalled();
});

it("makes remembered consent explicit and names the destination after a later automatic move", async () => {
  localStorage.removeItem(consentKey);
  const first = open();
  fireEvent.click(
    await screen.findByRole("checkbox", {
      name: `Move pipelines I open to ${backendUrl} without asking`,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(localStorage.getItem(consentKey)).toBe("true");
  first.unmount();
  open(undefined, { name: "Another pipeline", fileId: "another-local-id" });
  await waitFor(() => expect(onMigrated).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(notify).toHaveBeenCalledWith(
    `Pipeline moved to ${backendUrl}.`,
    "success",
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
    if (mode === "deployment") vi.stubEnv("VITE_REMOTE_PIPELINES", "false");
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
      expect.stringContaining("former project is not accessible"),
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
      backendUrl,
    ],
    { file: local, keepLocalCopy: false },
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
      activeBackendUrl,
    ],
    { file: remote, keepLocalCopy: false },
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

it("honors revoked consent before an already-mounted inactive tab becomes active", async () => {
  const view = (active: boolean) => (
    <QueryClientProvider client={client}>
      <LocalPipelineMigration
        pipelineRef={pipelineRef}
        isActive={active}
        onMigrated={onMigrated}
      >
        <p>Local editor</p>
      </LocalPipelineMigration>
    </QueryClientProvider>
  );
  const { rerender } = render(view(false));
  await waitFor(() => expect(storage.resolvePipeline).toHaveBeenCalled());
  act(() => revokePipelineMigrationConsent(backendUrl));
  rerender(view(true));
  expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
});

it("keeps a manually uploaded browser copy editable without prompting again", async () => {
  await pipelineStorageDb.pipeline_migration_attempts.put({
    localId: local.id,
    backendUrl,
    content: "saved",
    keepLocalCopy: true,
  });
  localStorage.removeItem(consentKey);
  open();
  await screen.findByText("Local editor");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
});

it("does not offer a nonexistent local editor when a queued move completed on another backend", async () => {
  storage.moveLocalPipelineToRemote.mockRejectedValue(
    new PipelineMovedToBackendError(
      "This pipeline was moved to another backend. Select that backend in Settings to open it.",
    ),
  );
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Select that backend",
  );
  expect(screen.queryByText("Local editor")).not.toBeInTheDocument();
  expect(
    screen.queryByText(/local copy is still available/),
  ).not.toBeInTheDocument();
});

it.each([false, true])(
  "describes a retained browser copy during project repair (remembered: %s)",
  async (remembered) => {
    await pipelineStorageDb.pipeline_migration_attempts.put({
      localId: local.id,
      backendUrl,
      content: "saved",
      keepLocalCopy: true,
    });
    if (!remembered) localStorage.removeItem(consentKey);
    open("project-id");
    if (remembered) {
      await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
      expect(notify).toHaveBeenCalledWith(
        `Pipeline uploaded to ${backendUrl}.`,
        "success",
      );
    } else {
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("The browser copy is kept.");
      expect(dialog).not.toHaveTextContent("browser copy is removed");
      expect(screen.getByRole("button", { name: "Upload" })).toBeVisible();
    }
  },
);
