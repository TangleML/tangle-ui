import "fake-indexeddb/auto";
import "@/routes/v2/pages/Tangent/workarea/pipelineKind";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type ReactNode, useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { pipelineStorageDb } from "@/services/pipelineStorage/db";
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";

import { DynamicWorkarea } from "./DynamicWorkarea";

const { storage, shortcuts, loadSpec, providerMounted, providerUnmounted } =
  vi.hoisted(() => ({
    storage: { resolvePipeline: vi.fn(), moveLocalPipelineToRemote: vi.fn() },
    shortcuts: vi.fn(),
    loadSpec: vi.fn(),
    providerMounted: vi.fn(),
    providerUnmounted: vi.fn(),
  }));
let store: TangentProjectStore;
let client: QueryClient;
const backendUrl = "https://backend.example.com";
const local = {
  id: "local-id",
  storageKey: "Pipeline",
  folder: { driver: { type: "root-indexdb" } },
};
const otherLocal = {
  id: "other-local-id",
  storageKey: "Other pipeline",
  folder: { driver: { type: "root-indexdb" } },
};
const consentKey = `local-pipeline-migration-consent-v1:${backendUrl}`;
const remote = {
  id: "remote-id",
  storageKey: "Pipeline",
  folder: { driver: { type: "remote-pipeline", canEdit: true } },
  remote: { backendUrl, pipelineId: "remote-id" },
};

function PassThrough({ children }: { children: ReactNode }) {
  return children;
}
function AgentBoundaryProbe({
  environmentId,
  onEnvironmentReady,
}: {
  environmentId: string;
  onEnvironmentReady: (id: string) => void;
}) {
  const initial = useRef({ environmentId, onEnvironmentReady });
  useEffect(() => {
    providerMounted();
    initial.current.onEnvironmentReady(initial.current.environmentId);
    return () => {
      providerUnmounted();
    };
  }, []);
  return null;
}

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => store,
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl, ready: true, configured: true }),
}));
vi.mock("@/providers/TourProvider/TourModeContext", () => ({
  useTourMode: () => undefined,
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/services/remotePipelineEditorService", () => ({
  getRemotePipelineWriter: vi.fn(),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/services/projects/moveLocalPipelineResourceToRemote", () => ({
  moveLocalPipelineResourceToRemote: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/components/DriverPermissionGate", () => ({
  DriverPermissionGate: PassThrough,
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useLoadSpec", () => ({
  useLoadSpec: loadSpec,
}));
vi.mock("@/routes/v2/shared/shortcuts/useShortcutListener", () => ({
  useShortcutListener: shortcuts,
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  SharedStoreProvider: PassThrough,
  useSharedStores: () => ({ navigation: { activeSpec: { name: "Pipeline" } } }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreRegistrar", () => ({
  SharedStoreRegistrar: () => null,
}));
vi.mock("@/routes/v2/pages/Editor/TangentEditorAgentProvider", () => ({
  TangentEditorAgentProvider: AgentBoundaryProbe,
}));
vi.mock("@/routes/v2/pages/Editor/components/FlowCanvas/FlowCanvas", () => ({
  FlowCanvas: () => <input aria-label="Pipeline canvas" />,
}));
vi.mock("@/routes/v2/shared/windows/DockArea", () => ({
  DockArea: () => null,
}));
vi.mock("@/routes/v2/shared/windows/WindowContainer", () => ({
  WindowContainer: () => null,
}));
vi.mock(
  "@/routes/v2/pages/Editor/components/RemotePipelineSaveRecovery",
  () => ({ RemotePipelineSaveRecovery: () => null }),
);
vi.mock("@/routes/v2/pages/Editor/components/QuickRunSubmitter", () => ({
  QuickRunSubmitter: () => null,
}));
vi.mock("@/routes/v2/pages/Editor/components/QuickRunSubmitterContext", () => ({
  QuickRunSubmitterProvider: PassThrough,
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  EditorSessionProvider: PassThrough,
}));
vi.mock("@/providers/RunSubmissionScopeProvider", () => ({
  RunSubmissionScopeProvider: PassThrough,
}));
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  ComponentLibraryProvider: PassThrough,
}));
vi.mock("@/providers/ComponentLibraryProvider/ForcedSearchProvider", () => ({
  ForcedSearchProvider: PassThrough,
}));
vi.mock("@/components/shared/ComponentEditor/ComponentEditorProvider", () => ({
  ComponentEditorProvider: PassThrough,
}));
vi.mock("@/routes/v2/shared/nodes/NodeRegistryContext", () => ({
  NodeRegistryProvider: PassThrough,
}));
vi.mock("@/routes/v2/shared/providers/SpecContext", () => ({
  SpecProvider: PassThrough,
}));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => false,
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useSpecLifecycle", () => ({
  useSpecLifecycle: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useSelectionWindowSync", () => ({
  useSelectionWindowSync: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useLinkedWindowCleanup", () => ({
  useLinkedWindowCleanup: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useComponentLibraryWindow", () => ({
  useComponentLibraryWindow: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/usePipelineDetailsWindow", () => ({
  usePipelineDetailsWindow: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useHistoryWindow", () => ({
  useHistoryWindow: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useRecentRunsWindow", () => ({
  useRecentRunsWindow: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useRunsAndSubmissionWindow", () => ({
  useRunsAndSubmissionWindow: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useUndoRedoKeyboard", () => ({
  useUndoRedoKeyboard: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useEditorEscapeShortcut", () => ({
  useEditorEscapeShortcut: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useComponentSearchV2Window", () => ({
  useComponentSearchV2Window: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useEmbeddedInitialDockLayout", () => ({
  useEmbeddedInitialDockLayout: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  localStorage.clear();
  await pipelineStorageDb.pipeline_migration_attempts.clear();
  store = new TangentProjectStore("project-1");
  store.setDefaultSessionId("session-1");
  store.hideWorkarea();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  storage.moveLocalPipelineToRemote.mockResolvedValue(remote);
  vi.mocked(getRemotePipelineWriter).mockResolvedValue("writer");
  loadSpec.mockReturnValue({
    data: { spec: { name: "Pipeline" }, file: remote },
  });
});
afterEach(() => {
  client.clear();
  vi.unstubAllEnvs();
});

function openHiddenPipeline() {
  const tab = store.openResolvedView({
    title: "Pipeline",
    target: { type: "pipeline", identity: "id/local-id" },
  });
  renderWorkarea();
  return tab;
}

function openPipelineTab(fileId: string, title: string) {
  return store.openResolvedView({
    title,
    target: { type: "pipeline", identity: `id/${fileId}` },
  });
}

function renderWorkarea() {
  render(
    <QueryClientProvider client={client}>
      <DynamicWorkarea />
    </QueryClientProvider>,
  );
}

// Consent is remembered in localStorage and read through a storage-event
// subscription, which is also how a second tab learns about it.
function rememberConsentFromAnotherTab() {
  localStorage.setItem(consentKey, "true");
  window.dispatchEvent(new StorageEvent("storage", { key: consentKey }));
}

function movedFileIds(): string[] {
  return storage.moveLocalPipelineToRemote.mock.calls.map(
    (call: unknown[]) => (call[0] as { id: string }).id,
  );
}

async function expectHiddenReady(tabId: string) {
  await waitFor(() =>
    expect(store.workareaTabs[0].target.identity).toBe("remote/remote-id"),
  );
  await waitFor(() =>
    expect(store.getTabEnvironmentId(tabId)).toBe(`session-1:${tabId}`),
  );
  expect(store.workareaCollapsed).toBe(true);
  expect(shortcuts).toHaveBeenCalledWith(false);
  expect(shortcuts).not.toHaveBeenCalledWith(true);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(providerMounted).toHaveBeenCalledOnce();
  expect(providerUnmounted).not.toHaveBeenCalled();
}

describe("hidden pipeline migration readiness through the real workarea/editor path", () => {
  it("redirects an already-moved local alias and connects without consent or write permission", async () => {
    storage.resolvePipeline.mockResolvedValue(remote);
    vi.mocked(getRemotePipelineWriter).mockRejectedValue(
      new Error("No write permission"),
    );
    const tab = openHiddenPipeline();
    await expectHiddenReady(tab.id);
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
    expect(getRemotePipelineWriter).not.toHaveBeenCalled();
  });

  it("completes an already-consented move while hidden with shortcuts inactive", async () => {
    localStorage.setItem(
      `local-pipeline-migration-consent-v1:${backendUrl}`,
      "true",
    );
    storage.resolvePipeline.mockResolvedValue(local);
    const tab = openHiddenPipeline();
    await expectHiddenReady(tab.id);
    expect(storage.moveLocalPipelineToRemote).toHaveBeenCalledOnce();
    expect(getRemotePipelineWriter).toHaveBeenCalled();
  });

  it("migrates only the selected tab, leaving other mounted tabs local", async () => {
    localStorage.setItem(consentKey, "true");
    storage.resolvePipeline.mockImplementation(
      ({ fileId }: { fileId: string }) =>
        Promise.resolve(fileId === "local-id" ? local : otherLocal),
    );
    openPipelineTab("local-id", "Pipeline");
    // Opening the second tab selects it; the first stays mounted but unselected.
    const selected = openPipelineTab("other-local-id", "Other pipeline");
    renderWorkarea();

    await waitFor(() =>
      expect(storage.moveLocalPipelineToRemote).toHaveBeenCalled(),
    );
    await act(async () => {});
    expect(movedFileIds()).toEqual(["other-local-id"]);
    expect(store.activeWorkareaTabId).toBe(selected.id);
    expect(store.workareaCollapsed).toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps a cancelled pipeline local when consent arrives from another tab", async () => {
    storage.resolvePipeline.mockResolvedValue(local);
    store.showWorkarea();
    openPipelineTab("local-id", "Pipeline");
    renderWorkarea();

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    rememberConsentFromAnotherTab();
    await act(async () => {});
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();

    // Collapsing must not revive the cancelled migration either.
    act(() => store.hideWorkarea());
    await act(async () => {});
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  });

  it("does not upload or portal a consent dialog while hidden; showing still asks", async () => {
    storage.resolvePipeline.mockResolvedValue(local);
    openHiddenPipeline();
    await waitFor(() => expect(storage.resolvePipeline).toHaveBeenCalled());
    await act(async () => {});
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
    expect(getRemotePipelineWriter).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(providerMounted).not.toHaveBeenCalled();
    act(() => store.showWorkarea());
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(storage.moveLocalPipelineToRemote).not.toHaveBeenCalled();
  });
});
