import "fake-indexeddb/auto";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { runInAction } from "mobx";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  IncrementingIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";
import { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import { DocumentSaveState } from "@/routes/v2/pages/Editor/store/documentSaveState";
import { UndoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import {
  RemotePipelineDeletionUncertainError,
  withRemotePipelineDeletion,
} from "@/services/pipelineStorage/remotePipelineDeletion";
import { componentSpecFromYaml } from "@/utils/yaml";

import { RemotePipelineSaveRecovery } from "./RemotePipelineSaveRecovery";

const notify = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
let autoSave: AutoSaveStore;
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
let storage: PipelineStorageService;
let navigation: NavigationStore;
let document: DocumentSaveState;
const remoteWrite = vi.fn();
const source = {
  remote: { pipelineId: "original", backendUrl: "https://backend.example.com" },
  isDraft: false,
  write: remoteWrite,
};
vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation }),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({
    autoSave,
    pipelineFile: { activePipelineFile: source },
  }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton",
  () => ({ exportPipeline: vi.fn() }),
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  source.remote.pipelineId = crypto.randomUUID();
  storage = new PipelineStorageService();
  navigation = new NavigationStore(new EditorStore());
  navigation.initNavigation(
    new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
      name: `Recovery ${crypto.randomUUID()}`,
      description: "Unsaved edits",
      inputs: [{ name: "greeting", type: "String", value: "latest value" }],
      implementation: { graph: { tasks: {} } },
    }),
  );
  document = new DocumentSaveState("unsaved");
  runInAction(() => {
    document.currentYaml = serializeComponentSpecToText(navigation.rootSpec!);
    document.pendingCount = 1;
  });
  autoSave = new AutoSaveStore(new UndoStore());
  autoSave.init(
    navigation.rootSpec!,
    source as unknown as PipelineFile,
    document,
  );
  document.recordError(new Error("The backend is unavailable."));
});
afterEach(() => {
  cleanup();
  runInAction(() => {
    document.lastSavedYaml = document.currentYaml;
  });
  autoSave.dispose();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function requestCopy() {
  fireEvent.click(screen.getByRole("button", { name: "Save local copy" }));
  await screen.findByRole("dialog");
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "Save local copy" }).at(-1),
    ).toBeEnabled(),
  );
  fireEvent.click(
    screen.getAllByRole("button", { name: "Save local copy" }).at(-1)!,
  );
}

it("persists the current unsaved model in browser storage during a remote retry", async () => {
  const name = `${navigation.rootSpec!.name} (Local copy)`;
  render(<RemotePipelineSaveRecovery />);
  expect(
    screen.getByRole("button", { name: "Retry remote save" }),
  ).toBeDisabled();
  await requestCopy();
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("in this browser"),
      "success",
    ),
  );
  const reopened = await new PipelineStorageService().resolvePipelineByName(
    name,
  );
  expect(reopened).toBeDefined();
  expect(componentSpecFromYaml(await reopened!.read())).toMatchObject({
    name,
    description: "Unsaved edits",
    inputs: [{ value: "latest value" }],
  });
  expect(remoteWrite).not.toHaveBeenCalled();
  expect(document.error).toBeNull();
  expect(document.hasUnsavedChanges).toBe(false);
  expect(navigate).toHaveBeenCalledWith(
    expect.objectContaining({
      params: { pipelineName: reopened!.storageKey },
      search: { fileId: reopened!.id },
      state: { recoveryLocalFileId: reopened!.id },
    }),
  );
  expect(navigation.rootSpec!.description).toBe("Unsaved edits");
});

it.each(["deleted", "uncertain"])(
  "offers local recovery without retrying a pipeline whose deletion is %s",
  async (state) => {
    await withRemotePipelineDeletion(
      { source: "remote", ...source.remote },
      `pipelines/${source.remote.pipelineId}.yaml`,
      async () => {
        if (state === "uncertain")
          throw new RemotePipelineDeletionUncertainError();
      },
    ).catch(() => {});
    render(<RemotePipelineSaveRecovery />);
    expect(
      screen.queryByRole("button", { name: "Retry remote save" }),
    ).toBeNull();
    await requestCopy();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(remoteWrite).not.toHaveBeenCalled();
  },
);

it("keeps the remote model and reports a failed local copy without claiming success", async () => {
  vi.spyOn(storage.rootFolder, "addFile").mockRejectedValueOnce(
    new Error("Browser storage is full"),
  );
  const spec = navigation.rootSpec;
  render(<RemotePipelineSaveRecovery />);
  await requestCopy();
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith("Browser storage is full", "error"),
  );
  expect(notify).not.toHaveBeenCalledWith(expect.anything(), "success");
  expect(navigation.rootSpec).toBe(spec);
  expect(remoteWrite).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Save a local copy before closing it",
  );
});

it("keeps newer source edits in the tab when they arrive during a successful copy", async () => {
  const add = storage.rootFolder.addFile.bind(storage.rootFolder);
  const pending = Promise.withResolvers<void>();
  vi.spyOn(storage.rootFolder, "addFile").mockImplementation(
    async (...args) => {
      await pending.promise;
      return add(...args);
    },
  );
  render(<RemotePipelineSaveRecovery />);
  await requestCopy();
  runInAction(() =>
    navigation.rootSpec!.setDescription("Edited while copying"),
  );
  pending.resolve();
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Newer changes remain"),
      "success",
    ),
  );
  expect(navigate).not.toHaveBeenCalled();
  expect(document.hasUnsavedChanges).toBe(true);
  expect(document.error).toBe("The backend is unavailable.");
});
