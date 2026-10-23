import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { PipelineMigrationRecoveryError } from "@/services/pipelineStorage/migrateLocalPipelineToRemote";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { getAllComponentFilesFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { componentSpecToYaml } from "@/utils/yaml";

import { PipelineSection } from "./PipelineSection";

const { upload, resolvePipeline, notify } = vi.hoisted(() => ({
  upload: vi.fn(),
  resolvePipeline: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/components/shared/Dialogs", async () => ({
  ConfirmationDialog: (
    await import("@/components/shared/Dialogs/ConfirmationDialog")
  ).default,
}));
vi.mock("@/components/Learn/ExamplePipelines", () => ({
  ExamplePipelines: () => null,
}));
vi.mock("@/components/shared/NewPipelineButton", () => ({
  default: () => null,
}));
vi.mock("@/components/shared/SuspenseWrapper", () => ({
  withSuspenseWrapper: <T extends object>(Component: ComponentType<T>) =>
    Component,
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://example.com",
    ready: true,
    configured: true,
    available: true,
  }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => ({
    moveLocalPipelineToRemote: upload,
    resolvePipeline,
  }),
}));
vi.mock("@/utils/componentStore", () => ({
  getAllComponentFilesFromList: vi.fn(),
}));
vi.mock("./PipelineFiltersBar", () => ({ PipelineFiltersBar: () => null }));
vi.mock("./usePipelineFilters", () => ({
  usePipelineFilters: (pipelines: Map<string, unknown>) => ({
    filteredPipelines: [...pipelines.entries()].map(([name, value]) => [
      name,
      value,
      {},
    ]),
    filterBarProps: {},
    filterKey: "",
  }),
}));
vi.mock("./BulkActionsBar", () => ({
  default: ({ selectedPipelines }: { selectedPipelines: string[] }) => (
    <span>Selected: {selectedPipelines.length}</span>
  ),
}));
vi.mock("./PipelineRow", () => ({
  default: ({
    name,
    onSaveAsRemote,
    saveAsRemoteDisabled,
    isSelected,
    onSelect,
  }: {
    name: string;
    onSaveAsRemote: () => void;
    saveAsRemoteDisabled: boolean;
    isSelected: boolean;
    onSelect: (selected: boolean) => void;
  }) => (
    <tr>
      <td>{name}</td>
      <td>
        <input
          aria-label={`Select ${name}`}
          type="checkbox"
          checked={isSelected}
          onChange={(event) => onSelect(event.target.checked)}
        />
        <button disabled={saveAsRemoteDisabled} onClick={onSaveAsRemote}>
          Upload {name}
        </button>
      </td>
    </tr>
  ),
}));

let queryClient: QueryClient;
let local: PipelineFile;
const emptyPipeline = componentSpecToYaml({
  name: "Example",
  implementation: { graph: { tasks: {} } },
});
const populatedPipeline = componentSpecToYaml({
  name: "Example",
  implementation: {
    graph: {
      tasks: {
        Example: {
          componentRef: {
            spec: { implementation: { container: { image: "python:3.12" } } },
          },
        },
      },
    },
  },
});

beforeEach(() => {
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  vi.clearAllMocks();
  localStorage.clear();
  local = new PipelineFile({
    id: "local-example",
    storageKey: "Example",
    folder: new PipelineStorageService().rootFolder,
  });
  vi.spyOn(local, "read").mockResolvedValue(populatedPipeline);
  vi.spyOn(local, "deleteFile").mockResolvedValue();
  resolvePipeline.mockResolvedValue(local);
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(
    new Map([
      [
        "Example",
        {
          name: "Example",
          creationTime: new Date(0),
          modificationTime: new Date(0),
          data: new ArrayBuffer(0),
          componentRef: {
            digest: "example",
            spec: { implementation: { graph: { tasks: {} } } },
            text: "",
          },
        },
      ],
    ]),
  );
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllEnvs();
});

function renderSection() {
  render(
    <QueryClientProvider client={queryClient}>
      <PipelineSection />
    </QueryClientProvider>,
  );
  return screen.findByRole("button", { name: "Upload Example" });
}

it("prevents duplicate uploads while pending and refreshes the list and selection after success", async () => {
  const pending = Promise.withResolvers<void>();
  upload.mockReturnValue(pending.promise);
  const button = await renderSection();
  fireEvent.click(screen.getByLabelText("Select Example"));
  fireEvent.click(button);
  await waitFor(() => expect(button).toBeDisabled());
  fireEvent.click(button);
  expect(upload).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
  await waitFor(() =>
    expect(upload).toHaveBeenCalledExactlyOnceWith(
      local,
      "https://example.com",
      undefined,
      { keepLocalCopy: true },
    ),
  );

  const files = await getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME);
  const remaining = files.get("Example");
  if (!remaining) throw new Error("Missing pipeline fixture");
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(
    new Map([
      ["Example", remaining],
      ["Remaining", { ...remaining, name: "Remaining" }],
    ]),
  );
  await act(async () => pending.resolve());
  expect(
    await screen.findByRole("button", { name: "Upload Example" }),
  ).toBeEnabled();
  expect(
    await screen.findByRole("button", { name: "Upload Remaining" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Selected: 1")).not.toBeInTheDocument();
  expect(notify).toHaveBeenCalledWith("Pipeline uploaded.", "success");
});

it("keeps the local row and selection available after upload fails", async () => {
  const pending = Promise.withResolvers<void>();
  upload.mockReturnValue(pending.promise);
  const button = await renderSection();
  fireEvent.click(screen.getByLabelText("Select Example"));
  fireEvent.click(button);
  await waitFor(() => expect(button).toBeDisabled());
  fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
  await waitFor(() => expect(upload).toHaveBeenCalledOnce());

  await act(async () => pending.reject(new Error("Upload failed")));
  expect(
    await screen.findByRole("button", { name: "Upload Example" }),
  ).toBeEnabled();
  expect(screen.getByLabelText("Select Example")).toBeChecked();
  expect(notify).toHaveBeenCalledWith("Upload failed", "error");
});

it("reports an incomplete link repair as a warning and keeps the browser row", async () => {
  const error = new PipelineMigrationRecoveryError(
    "Pipeline was uploaded, but its saved links could not be updated. The copy in this browser was kept.",
    new PipelineFile({
      id: "remote-1",
      storageKey: "Example",
      folder: new PipelineStorageService().rootFolder,
    }),
  );
  upload.mockRejectedValue(error);
  const button = await renderSection();
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole("button", { name: "Upload" }));

  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(error.message, "warning"),
  );
  expect(
    await screen.findByRole("button", { name: "Upload Example" }),
  ).toBeEnabled();
  expect(notify).not.toHaveBeenCalledWith("Pipeline uploaded.", "success");
});

it("explains sharing and retained links before uploading and preserves cancellation", async () => {
  localStorage.setItem("skip-save-as-remote-pipeline-confirmation", "true");
  const button = await renderSection();
  fireEvent.click(button);
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(
    "Other users with read access to that backend can see them.",
  );
  expect(dialog).toHaveTextContent(
    "Its browser copy and existing project links are kept",
  );
  expect(
    screen.queryByLabelText("Don't show this again"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(upload).not.toHaveBeenCalled();
  expect(local.deleteFile).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});

it("warns that an empty pipeline will be deleted and keeps it after cancellation", async () => {
  vi.mocked(local.read).mockResolvedValue(emptyPipeline);
  const button = await renderSection();
  fireEvent.click(screen.getByLabelText("Select Example"));
  fireEvent.click(button);
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent('Delete empty pipeline "Example"?');
  expect(dialog).toHaveTextContent(
    "Uploading it will delete the browser copy instead of creating a remote pipeline.",
  );
  expect(
    screen.queryByRole("button", { name: "Upload" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Select Example")).toBeChecked();
  expect(local.deleteFile).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});

it("deletes a confirmed empty pipeline and refreshes the list without uploading", async () => {
  vi.mocked(local.read).mockResolvedValue(emptyPipeline);
  const button = await renderSection();
  fireEvent.click(screen.getByLabelText("Select Example"));
  fireEvent.click(button);
  const confirm = await screen.findByRole("button", {
    name: "Delete empty pipeline",
  });
  expect(local.deleteFile).not.toHaveBeenCalled();
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(new Map());
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith("Empty pipeline deleted.", "success"),
  );
  expect(local.deleteFile).toHaveBeenCalledOnce();
  expect(upload).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Upload Example" }),
  ).not.toBeInTheDocument();
  expect(notify).not.toHaveBeenCalledWith("Pipeline uploaded.", "success");
});

it("keeps the row available and reports a failed deletion", async () => {
  vi.mocked(local.read).mockResolvedValue(emptyPipeline);
  vi.mocked(local.deleteFile).mockRejectedValue(
    new Error("Could not delete pipeline"),
  );
  const button = await renderSection();
  fireEvent.click(button);
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete empty pipeline" }),
  );
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith("Could not delete pipeline", "error"),
  );
  expect(
    await screen.findByRole("button", { name: "Upload Example" }),
  ).toBeEnabled();
  expect(upload).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalledWith("Empty pipeline deleted.", "success");
});

it("preserves work added while the empty-pipeline warning was open", async () => {
  vi.mocked(local.read).mockResolvedValue(emptyPipeline);
  const button = await renderSection();
  fireEvent.click(button);
  const confirm = await screen.findByRole("button", {
    name: "Delete empty pipeline",
  });
  vi.mocked(local.read).mockResolvedValue(populatedPipeline);
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      "This pipeline changed while the confirmation was open. Nothing was uploaded or deleted. Try uploading again.",
      "error",
    ),
  );
  expect(local.deleteFile).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});
