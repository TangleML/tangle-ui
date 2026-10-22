import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { APP_ROUTES } from "@/routes/appRoutes";
import { componentSpecFromYaml } from "@/utils/yaml";

import { useFileMenuState } from "./useFileMenuState";

const state = vi.hoisted(() => ({
  spec: undefined as ComponentSpec | undefined,
  file: {
    id: "pipeline-1",
    storageKey: "Original",
    remote: undefined as { backendUrl: string; pipelineId: string } | undefined,
    isDraft: false,
    draftBackendUrl: undefined as string | undefined,
    rename: vi.fn(),
    write: vi.fn(),
    deleteFile: vi.fn(),
  },
  configured: true,
  storage: {
    rootFolder: { addFile: vi.fn() },
    copyRemotePipeline: vi.fn(),
    createRemotePipeline: vi.fn(),
  },
  save: vi.fn(),
  releaseRecoveredCopy: vi.fn(),
  navigate: vi.fn(),
  notify: vi.fn(),
}));
const remote = {
  backendUrl: "https://backend.example.com",
  pipelineId: "pipeline-1",
};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
}));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => true,
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: remote.backendUrl,
    configured: state.configured,
    ready: true,
  }),
}));
vi.mock("@/utils/localforage", () => ({
  getUseEnv: async () => false,
  getUseRelativePath: async () => false,
  getUserBackendUrl: async () => (state.configured ? remote.backendUrl : ""),
}));
vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/hooks/useToastNotification", () => ({
  default: () => state.notify,
}));
vi.mock("@/providers/TourProvider/TourModeContext", () => ({
  useTourMode: () => null,
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({
    autoSave: {
      save: state.save,
      releaseRecoveredCopy: state.releaseRecoveredCopy,
    },
    pipelineFile: { activePipelineFile: state.file },
  }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({
    navigation: { rootSpec: state.spec },
    keyboard: { registerShortcut: vi.fn() },
  }),
}));
vi.mock("@/routes/v2/pages/Editor/store/actions/usePipelineActions", () => ({
  usePipelineActions: () => ({
    renamePipeline: (spec: ComponentSpec, name: string) => spec.setName(name),
  }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => state.storage,
}));
vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton",
  () => ({
    exportPipeline: vi.fn(),
  }),
);

function renderFileMenu() {
  const client = new QueryClient();
  return renderHook(useFileMenuState, {
    wrapper: ({ children }) =>
      createElement(QueryClientProvider, { client }, children),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  state.spec = new ComponentSpec({ $id: "root", name: "Original" });
  state.spec.setDescription("Preserve the full pipeline content");
  state.file.remote = undefined;
  state.file.isDraft = false;
  state.file.draftBackendUrl = undefined;
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  state.configured = true;
  state.save.mockResolvedValue(undefined);
  state.navigate.mockResolvedValue(undefined);
  const copy = { id: "copy-id", storageKey: "Copy" };
  state.storage.rootFolder.addFile.mockResolvedValue(copy);
  state.storage.createRemotePipeline.mockResolvedValue({
    ...copy,
    remote: { ...remote, pipelineId: copy.id },
  });
  state.storage.copyRemotePipeline.mockResolvedValue({
    ...copy,
    remote: { ...remote, pipelineId: copy.id },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("editor file actions", () => {
  it("renames a draft as a content edit and saves copies remotely", async () => {
    state.file.isDraft = true;
    state.file.draftBackendUrl = remote.backendUrl;
    const { result } = renderFileMenu();
    await result.current.renamePipeline("Renamed draft");
    expect(state.save).toHaveBeenCalledOnce();
    expect(state.spec?.name).toBe("Renamed draft");
    expect(state.navigate).not.toHaveBeenCalled();
    await result.current.handleSavePipelineAs("Copy");
    expect(state.storage.createRemotePipeline).toHaveBeenCalledWith(
      remote.backendUrl,
      "Copy",
      expect.any(String),
    );
    expect(state.storage.rootFolder.addFile).not.toHaveBeenCalled();
  });
  it.each([
    { sourceRemote: false, local: false, configured: true },
    { sourceRemote: true, local: false, configured: true },
    { sourceRemote: false, local: true, configured: true },
    { sourceRemote: true, local: true, configured: true },
    { sourceRemote: false, local: false, configured: false },
    { sourceRemote: true, local: false, configured: false },
  ])(
    "copies content using the deployment policy: %j",
    async ({ sourceRemote, local, configured }) => {
      state.configured = configured;
      vi.stubEnv("VITE_LOCAL_PIPELINES", String(local));
      if (sourceRemote) state.file.remote = remote;
      const isRemote = !local && configured;
      const { result } = renderFileMenu();
      await result.current.handleSavePipelineAs("Copy");
      const target = isRemote
        ? sourceRemote
          ? state.storage.copyRemotePipeline
          : state.storage.createRemotePipeline
        : state.storage.rootFolder.addFile;
      const other = isRemote
        ? state.storage.rootFolder.addFile
        : state.storage.copyRemotePipeline;
      expect(target).toHaveBeenCalledExactlyOnceWith(
        ...(isRemote ? [sourceRemote ? state.file : remote.backendUrl] : []),
        "Copy",
        expect.any(String),
      );
      expect(componentSpecFromYaml(target.mock.calls[0].at(-1))).toMatchObject({
        name: "Copy",
        description: "Preserve the full pipeline content",
      });
      expect(other).not.toHaveBeenCalled();
      expect(state.file.rename).not.toHaveBeenCalled();
      expect(state.file.write).not.toHaveBeenCalled();
      expect(state.save).not.toHaveBeenCalled();
      expect(state.spec?.name).toBe("Original");
      expect(state.navigate).toHaveBeenCalledWith(
        isRemote
          ? {
              to: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
              params: { pipelineId: "copy-id" },
            }
          : {
              to: APP_ROUTES.EDITOR_V2_PIPELINE,
              params: { pipelineName: "Copy" },
              search: { fileId: "copy-id" },
            },
      );
    },
  );

  it.each([false, true])(
    "persists rename and only changes a local route (remote: %s)",
    async (isRemote) => {
      if (isRemote) state.file.remote = remote;
      const { result } = renderFileMenu();
      await result.current.renamePipeline("Renamed");
      expect(state.file.rename).toHaveBeenCalledWith("Renamed");
      expect(state.spec?.name).toBe("Renamed");
      expect(state.save).toHaveBeenCalledTimes(isRemote ? 1 : 2);
      expect(state.save.mock.invocationCallOrder[0]).toBeLessThan(
        state.file.rename.mock.invocationCallOrder[0],
      );
      if (isRemote) expect(state.navigate).not.toHaveBeenCalled();
      else
        expect(state.navigate).toHaveBeenCalledWith({
          to: APP_ROUTES.EDITOR_V2_PIPELINE,
          params: { pipelineName: "Renamed" },
          search: { fileId: state.file.id },
        });
    },
  );

  it("queues a remote rename before navigation disposes the editor", async () => {
    state.file.remote = remote;
    let finishRename!: () => void;
    state.file.rename.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishRename = resolve;
      }),
    );
    const { result, unmount } = renderFileMenu();
    const rename = result.current.renamePipeline("Renamed");
    await Promise.resolve();
    unmount();
    state.save.mockRejectedValue(new Error("The editor has been disposed"));
    finishRename();
    await rename;
    expect(state.spec?.name).toBe("Renamed");
    expect(state.save).toHaveBeenCalledOnce();
    expect(state.notify).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it.each(["save", "copy", "rename"] as const)(
    "reports %s failures without navigating",
    async (action) => {
      state.file.remote = remote;
      state.save.mockRejectedValue(new Error("Write failed"));
      state.storage.copyRemotePipeline.mockRejectedValue(
        new Error("Write failed"),
      );
      const { result } = renderFileMenu();
      if (action === "save") await result.current.handleSave();
      else if (action === "copy")
        await result.current.handleSavePipelineAs("Copy");
      else await result.current.renamePipeline("Renamed");
      expect(state.notify).toHaveBeenCalledWith("Write failed", "error");
      expect(state.navigate).not.toHaveBeenCalled();
      expect(state.releaseRecoveredCopy).not.toHaveBeenCalled();
      expect(state.file.rename).toHaveBeenCalledTimes(
        action === "rename" ? 1 : 0,
      );
      expect(state.storage.rootFolder.addFile).not.toHaveBeenCalled();
      expect(state.spec?.name).toBe(
        action === "rename" ? "Renamed" : "Original",
      );
    },
  );
});

it("acknowledges the captured source only after its copy succeeds", async () => {
  state.file.remote = remote;
  const pending = Promise.withResolvers<{ id: string; storageKey: string }>();
  state.storage.copyRemotePipeline.mockReturnValue(pending.promise);
  const { result } = renderFileMenu();
  const saving = result.current.handleSavePipelineAs("Copy");
  await vi.waitFor(() =>
    expect(state.storage.copyRemotePipeline).toHaveBeenCalledOnce(),
  );
  expect(state.releaseRecoveredCopy).not.toHaveBeenCalled();
  pending.resolve({ id: "copy-id", storageKey: "Copy" });
  await saving;
  expect(state.releaseRecoveredCopy).toHaveBeenCalledWith(
    state.file,
    expect.stringContaining("Preserve the full pipeline content"),
  );
});
