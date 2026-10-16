import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { getPipelineCreationBackendUrl } from "@/services/pipelineStorage/pipelineCreation";
import { moveLocalPipelineResourceToRemote } from "@/services/projects/moveLocalPipelineResourceToRemote";

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
vi.mock("@/services/projects/moveLocalPipelineResourceToRemote", () => ({
  moveLocalPipelineResourceToRemote: vi.fn(),
}));

const backendUrl = "https://backend.example.com";
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
  folder: local.folder,
  remote: { backendUrl, pipelineId: "remote-id" },
};
const pipelineRef = { name: "Old name", fileId: local.id };

function open(projectId?: string) {
  return render(
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
    </StrictMode>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  storage.resolvePipeline.mockResolvedValue(local);
  storage.moveLocalPipelineToRemote.mockResolvedValue(remote);
  vi.mocked(getPipelineCreationBackendUrl).mockResolvedValue(backendUrl);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllEnvs();
});

it("uploads the resolved file once on open, before enabling edits", async () => {
  open();
  expect(screen.queryByText("Local editor")).not.toBeInTheDocument();
  await waitFor(() => expect(onMigrated).toHaveBeenCalledWith(remote));
  expect(storage.resolvePipeline).toHaveBeenCalledExactlyOnceWith(pipelineRef);
  expect(storage.moveLocalPipelineToRemote).toHaveBeenCalledExactlyOnceWith(
    local,
    backendUrl,
    undefined,
  );
});

it("keeps the local editor when the deployment selects local storage", () => {
  vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
  open();
  expect(screen.getByText("Local editor")).toBeInTheDocument();
  expect(storage.resolvePipeline).not.toHaveBeenCalled();
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

it("supplies the current project's association update to the upload service", async () => {
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
});
