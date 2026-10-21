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

import { getAllComponentFilesFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { PipelineSection } from "./PipelineSection";

const { upload, notify } = vi.hoisted(() => ({
  upload: vi.fn(),
  notify: vi.fn(),
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
  usePipelineStorage: () => ({ moveLocalPipelineToRemote: upload }),
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

beforeEach(() => {
  vi.clearAllMocks();
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
  expect(upload).toHaveBeenCalledExactlyOnceWith(
    "Example",
    "https://example.com",
  );

  const files = await getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME);
  const remaining = files.get("Example");
  if (!remaining) throw new Error("Missing pipeline fixture");
  vi.mocked(getAllComponentFilesFromList).mockResolvedValue(
    new Map([["Remaining", { ...remaining, name: "Remaining" }]]),
  );
  await act(async () => pending.resolve());
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Upload Example" }),
    ).not.toBeInTheDocument(),
  );
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

  await act(async () => pending.reject(new Error("Upload failed")));
  expect(
    await screen.findByRole("button", { name: "Upload Example" }),
  ).toBeEnabled();
  expect(screen.getByLabelText("Select Example")).toBeChecked();
  expect(notify).toHaveBeenCalledWith("Upload failed", "error");
});
