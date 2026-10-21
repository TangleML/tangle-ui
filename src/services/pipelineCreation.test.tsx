import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import {
  ComponentSpecProvider,
  useComponentSpec,
} from "@/providers/ComponentSpecProvider";
import * as backendSettings from "@/utils/backendSettings";
import {
  getComponentFileFromList,
  getComponentFileNamesFromList,
} from "@/utils/componentStore";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { copyRunToPipeline } from "./pipelineRunService";
import { importPipelineFromYaml, useSavePipeline } from "./pipelineService";
import type { SavedPipelineDocument } from "./pipelineSpecService";
import {
  createPipelineFromContent,
  createsLocalPipelines,
  getPipelineCreationBackendUrl,
  setBrowserPipelineStorage,
} from "./pipelineStorage/pipelineCreation";
import type { PipelineFile } from "./pipelineStorage/PipelineFile";
import { registeredStorageKeys } from "./pipelineStorage/pipelineRegistry";
import { PipelineStorageService } from "./pipelineStorage/PipelineStorageService";
import { editorSpecFromRemoteTask } from "./pipelineStorage/remotePipelineTask";
import { createAndAttachPipeline } from "./projects/createAndAttachPipeline";

const settings = vi.hoisted(() => ({
  apiUrl: "",
  useEnv: true,
  relative: true,
  userUrl: "",
}));
vi.mock("@/utils/constants", async (original) => ({
  ...(await original<typeof import("@/utils/constants")>()),
  get API_URL() {
    return settings.apiUrl;
  },
}));
vi.mock("@/utils/localforage", () => ({
  getUseEnv: async () => settings.useEnv,
  getUseRelativePath: async () => settings.relative,
  getUserBackendUrl: async () => settings.userUrl,
}));
vi.mock("@/utils/componentStore", () => ({
  generateDigest: async () => "digest",
  getComponentFileFromList: vi.fn(),
  getComponentFileNamesFromList: vi.fn(),
}));
vi.mock("./pipelineStorage/pipelineRegistry");
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));
vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton",
  () => ({ exportPipeline: vi.fn() }),
);
vi.mock("@/api/client.gen", () => ({ client: { put: vi.fn() } }));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: () => true,
}));
vi.mock("./pipelineStorage/createDriver", () => ({ createDriver: () => ({}) }));
vi.mock("./pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));

let storage: PipelineStorageService;
let localWrites: [string, string][];
const localFile = (name: string) =>
  ({
    id: `local-${name}`,
    storageKey: name,
    write: async (content: string) => {
      localWrites.push([name, content]);
    },
  }) as PipelineFile;

const spec = {
  name: "Example",
  inputs: [{ name: "greeting", type: "String", value: "before" }],
  implementation: { graph: { tasks: {} } },
};
const remoteId = "remote-1";
const remoteSpec = (index: number) =>
  editorSpecFromRemoteTask(
    (vi.mocked(client.put).mock.calls[index][0]?.body as SavedPipelineDocument)
      .root_pipeline_task,
  );

beforeEach(() => {
  vi.resetAllMocks();
  storage = new PipelineStorageService();
  localWrites = [];
  vi.spyOn(storage.rootFolder, "addFile").mockImplementation(
    async (name, content) => {
      localWrites.push([name, content]);
      return localFile(name);
    },
  );
  vi.spyOn(storage, "resolvePipeline").mockImplementation(async (ref) =>
    localFile("name" in ref ? ref.name : "Local"),
  );
  vi.spyOn(storage, "resolvePipelineByName").mockImplementation(async (name) =>
    localFile(name),
  );
  localStorage.clear();
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  Object.assign(settings, {
    apiUrl: "",
    useEnv: true,
    relative: true,
    userUrl: "",
  });
  vi.mocked(getComponentFileFromList).mockResolvedValue(null);
  vi.mocked(getComponentFileNamesFromList).mockResolvedValue([]);
  vi.mocked(registeredStorageKeys).mockResolvedValue([]);
  vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue({
    data: { id: "user", permissions: ["read", "write"] },
    response: new Response(null, { status: 200 }),
  } as never);
  vi.mocked(client.put).mockImplementation(
    async (options) =>
      ({
        data: {
          id: remoteId,
          user_id: "user",
          file_path: options?.query?.file_path,
          ...(options?.body as object),
        },
        response: new Response(null, { status: 200 }),
      }) as never,
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each([undefined, "false", "TRUE", "1"])(
  "keeps creation local unless remote storage is explicitly enabled (%s)",
  async (flag) => {
    vi.stubEnv("VITE_REMOTE_PIPELINES", flag);
    expect(createsLocalPipelines(true)).toBe(true);
    expect(await getPipelineCreationBackendUrl()).toBeUndefined();
    await createPipelineFromContent(
      storage,
      "Local default",
      componentSpecToYaml(spec),
    );
    expect(localWrites).toHaveLength(1);
    expect(client.put).not.toHaveBeenCalled();
    expect(getCurrentUserApiUsersMeGet).not.toHaveBeenCalled();
  },
);

it("keeps storage local without a backend even after opting in", async () => {
  settings.relative = false;
  expect(createsLocalPipelines(false)).toBe(true);
  expect(await getPipelineCreationBackendUrl()).toBeUndefined();
});

it.each([
  [{}, window.location.origin],
  [{ apiUrl: "https://deployed.example.com" }, "https://deployed.example.com"],
  [
    { useEnv: false, relative: false, userUrl: "https://custom.example.com" },
    "https://custom.example.com",
  ],
  [
    {
      apiUrl: "https://deployed.example.com",
      useEnv: false,
      userUrl: "https://custom.example.com",
    },
    "https://custom.example.com",
  ],
])("selects the creation backend: %j", async (config, expected) => {
  Object.assign(settings, config);
  expect(await getPipelineCreationBackendUrl()).toBe(expected);
});

it.each([
  { override: undefined, configured: true },
  { override: "false", configured: true },
  { override: "true", configured: true },
  { override: undefined, configured: false },
])(
  "uses the storage policy for imports, copies, and run clones (%j)",
  async ({ override, configured }) => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", override);
    settings.relative = configured;
    const local = override === "true" || !configured;
    const results = [
      await importPipelineFromYaml(storage, componentSpecToYaml(spec)),
      await useSavePipeline(spec).savePipeline("Copy"),
      await copyRunToPipeline(storage, spec, "run-7", "Clone", {
        greeting: "after",
      }),
    ];
    expect(localWrites).toHaveLength(local ? 3 : 0);
    expect(client.put).toHaveBeenCalledTimes(local ? 0 : 3);
    const specs = local
      ? localWrites.map(([, content]) => componentSpecFromYaml(content))
      : [0, 1, 2].map(remoteSpec);
    expect(specs[0]).toMatchObject(spec);
    expect(specs[1].name).toBe("Copy");
    expect(specs[2]).toMatchObject({
      name: "Clone",
      inputs: [{ value: "after" }],
      metadata: { annotations: { cloned_from_run_id: "run-7" } },
    });
    expect(spec.inputs[0].value).toBe("before");
    if (!local)
      for (const result of results)
        expect(result?.url).toBe(`/editor-v2/pipeline/${remoteId}`);
  },
);

it("keeps local collision handling and existing local edits", async () => {
  vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
  vi.mocked(getComponentFileFromList)
    .mockResolvedValueOnce({} as never)
    .mockResolvedValueOnce({} as never);
  vi.mocked(getComponentFileNamesFromList).mockResolvedValue(["Example"]);
  expect(
    await importPipelineFromYaml(storage, componentSpecToYaml(spec)),
  ).toMatchObject({ name: "Example 2", successful: true });
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  vi.mocked(getComponentFileFromList).mockResolvedValue({} as never);
  await useSavePipeline(spec).savePipeline();
  expect(localWrites).toHaveLength(2);
  expect(client.put).not.toHaveBeenCalled();
});

it.each([false, true])(
  "creates populated editor copies with local override %s",
  async (local) => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", String(local));
    const storage = new PipelineStorageService();
    const add = vi
      .spyOn(storage.rootFolder, "addFile")
      .mockResolvedValue({ id: "local-1" } as never);
    const file = await createPipelineFromContent(
      storage,
      spec.name,
      componentSpecToYaml(spec),
    );
    expect(file.id).toBe(local ? "local-1" : remoteId);
    expect(add).toHaveBeenCalledTimes(local ? 1 : 0);
    expect(client.put).toHaveBeenCalledTimes(local ? 0 : 1);
  },
);

it.each([
  "remote",
  "existing local",
  "local override",
  "no backend",
  "read-only",
])("saves legacy editor content: %s", async (mode) => {
  if (mode === "existing local")
    vi.mocked(getComponentFileFromList).mockResolvedValue({} as never);
  if (mode === "local override") vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
  if (mode === "no backend") settings.relative = false;
  const { result } = renderHook(useComponentSpec, {
    wrapper: ({ children }) => (
      <ComponentSpecProvider spec={spec} readOnly={mode === "read-only"}>
        {children}
      </ComponentSpecProvider>
    ),
  });
  await act(async () => {
    await Promise.all([
      result.current.saveComponentSpec("Renamed"),
      result.current.saveComponentSpec("Renamed"),
    ]);
  });
  expect(localWrites).toHaveLength(
    mode.includes("local") || mode === "no backend" ? 2 : 0,
  );
  expect(client.put).toHaveBeenCalledTimes(mode === "remote" ? 2 : 0);
  if (mode === "remote") {
    expect(result.current.componentSpec.name).toBe("Example");
    expect(remoteSpec(1).name).toBe("Renamed");
    expect(
      new Set(
        vi
          .mocked(client.put)
          .mock.calls.map(([options]) => options?.query?.file_path),
      ).size,
    ).toBe(1);
  }
});

it("reports a configured backend failure without a local fallback", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(client.put).mockRejectedValueOnce(new Error("Unavailable"));
  expect(
    await importPipelineFromYaml(storage, componentSpecToYaml(spec)),
  ).toMatchObject({ successful: false });
  expect(localWrites).toHaveLength(0);
});

it.each(["import", "save", "clone", "project"])(
  "keeps the resolved destination for %s when settings change",
  async (operation) => {
    const readSettings = vi.spyOn(backendSettings, "getBackendSettings");
    for (const local of [false, true]) {
      readSettings
        .mockClear()
        .mockResolvedValueOnce({
          useEnv: false,
          useRelativePath: false,
          userBackendUrl: local ? "" : "https://initial.example.com",
        })
        .mockResolvedValue({
          useEnv: false,
          useRelativePath: false,
          userBackendUrl: local ? "https://changed.example.com" : "",
        });
      localWrites = [];
      vi.mocked(client.put).mockClear();
      const expectedUrl = local
        ? "/editor-v2/Example"
        : `/editor-v2/pipeline/${remoteId}`;

      if (operation === "import") {
        const result = await importPipelineFromYaml(
          storage,
          componentSpecToYaml(spec),
        );
        expect(result.successful).toBe(true);
        expect(result.remote?.backendUrl).toBe(
          local ? undefined : "https://initial.example.com",
        );
      } else if (operation === "save") {
        expect((await useSavePipeline(spec).savePipeline("Example"))?.url).toBe(
          expectedUrl,
        );
      } else if (operation === "clone") {
        expect((await copyRunToPipeline(storage, spec, "run-1")).url).toBe(
          expectedUrl,
        );
      } else {
        const file = await createAndAttachPipeline({
          storage,
          name: "Example",
          attach: async () => {},
        });
        expect(file.draftBackendUrl).toBe(
          local ? undefined : "https://initial.example.com",
        );
      }

      expect(readSettings).toHaveBeenCalledTimes(1);
      expect(localWrites).toHaveLength(local ? 1 : 0);
      expect(client.put).toHaveBeenCalledTimes(
        local || operation === "project" ? 0 : 1,
      );
    }
  },
);

it.each(["clone", "save"])(
  "creates a %s beside a registry-only name",
  async (operation) => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
    vi.mocked(registeredStorageKeys).mockResolvedValue(["Example"]);

    const result =
      operation === "clone"
        ? await copyRunToPipeline(storage, spec, "run-1")
        : await useSavePipeline(spec).savePipeline("Example");

    expect(result?.url).toBe("/editor-v2/Example%202");
    expect(localWrites).toHaveLength(1);
    expect(localWrites[0][0]).toBe("Example 2");
    expect(componentSpecFromYaml(localWrites[0][1]).name).toBe("Example 2");
  },
);

function renderLegacyEditor() {
  return renderHook(useComponentSpec, {
    wrapper: ({ children }) => (
      <ComponentSpecProvider spec={spec}>{children}</ComponentSpecProvider>
    ),
  });
}

it.each(["clear", "unmount", "replace"])(
  "disposes a legacy editor draft after %s",
  async (action) => {
    const createDraft = vi.spyOn(storage, "createRemoteDraft");
    const { result, unmount } = renderLegacyEditor();
    await act(async () => {
      await result.current.saveComponentSpec("Saved");
    });
    const [ref] = createDraft.mock.calls[0];
    expect(storage.getRemoteDraftRef(ref.draftId, ref.backendUrl)).toEqual(ref);

    await act(async () => {
      if (action === "clear") result.current.clearComponentSpec();
      else if (action === "replace")
        result.current.setComponentSpec({ ...spec, name: "Another" });
      else unmount();
    });

    expect(storage.retainRemoteDraft(ref.draftId)).toBeUndefined();
  },
);

it("keeps an abandoned legacy draft until its pending write settles", async () => {
  let finish = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const createDraft = storage.createRemoteDraft.bind(storage);
  const create = vi
    .spyOn(storage, "createRemoteDraft")
    .mockImplementation((ref) => {
      const file = createDraft(ref);
      vi.spyOn(file, "write").mockReturnValue(pending);
      return file;
    });
  const { result } = renderLegacyEditor();
  const saving = result.current.saveComponentSpec("Saved");
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  const [ref] = create.mock.calls[0];

  await act(async () => result.current.clearComponentSpec());
  expect(storage.getRemoteDraftRef(ref.draftId, ref.backendUrl)).toEqual(ref);
  await act(async () => {
    finish();
    await saving;
  });
  expect(() => storage.getRemoteDraftRef(ref.draftId, ref.backendUrl)).toThrow(
    "no longer available",
  );
});

it("does not create a legacy draft after clearing during settings lookup", async () => {
  let finish = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.spyOn(backendSettings, "getBackendSettings").mockImplementation(
    async () => {
      await pending;
      return { useEnv: false, useRelativePath: true, userBackendUrl: "" };
    },
  );
  const create = vi.spyOn(storage, "createRemoteDraft");
  const { result } = renderLegacyEditor();
  const saving = result.current.saveComponentSpec("Saved");
  await act(async () => result.current.clearComponentSpec());
  await act(async () => {
    finish();
    await saving;
  });
  expect(create).not.toHaveBeenCalled();
});

it("starts a new legacy save draft when the backend changes", async () => {
  const create = vi.spyOn(storage, "createRemoteDraft");
  const { result } = renderLegacyEditor();
  await act(async () => {
    await result.current.saveComponentSpec("Saved");
    Object.assign(settings, {
      useEnv: false,
      relative: false,
      userUrl: "https://other.example.com",
    });
    await result.current.saveComponentSpec("Saved");
  });
  expect(create).toHaveBeenCalledTimes(2);
  const [original] = create.mock.calls[0];
  const [replacement] = create.mock.calls[1];
  expect(storage.retainRemoteDraft(original.draftId)).toBeUndefined();
  expect(replacement.backendUrl).toBe("https://other.example.com");
});

it("retries a synchronous legacy draft creation failure", async () => {
  const create = vi
    .spyOn(storage, "createRemoteDraft")
    .mockImplementationOnce(() => {
      throw new Error("Draft unavailable");
    });
  const { result } = renderLegacyEditor();
  await act(async () => {
    await expect(result.current.saveComponentSpec("Saved")).rejects.toThrow(
      "Draft unavailable",
    );
    await result.current.saveComponentSpec("Saved");
  });
  expect(create).toHaveBeenCalledTimes(2);
  expect(client.put).toHaveBeenCalledOnce();
});

it("honors the runtime browser-storage preference for imports", async () => {
  setBrowserPipelineStorage(true);
  expect(createsLocalPipelines()).toBe(true);
  const storage = new PipelineStorageService();
  const addFile = vi
    .spyOn(storage.rootFolder, "addFile")
    .mockResolvedValue({} as never);
  await createPipelineFromContent(
    storage,
    "Example",
    componentSpecToYaml(spec),
  );
  expect(addFile).toHaveBeenCalledOnce();
  expect(client.put).not.toHaveBeenCalled();
  setBrowserPipelineStorage(false);
  expect(createsLocalPipelines()).toBe(false);
});

it("propagates remote clone failures to the caller", async () => {
  vi.mocked(client.put).mockRejectedValueOnce(new Error("Backend unavailable"));
  await expect(copyRunToPipeline(storage, spec)).rejects.toMatchObject({
    kind: "unavailable",
    status: 0,
  });
});

it("keeps creation usable when browser preference storage is restricted", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Storage is unavailable", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is unavailable", "SecurityError");
  });
  await expect(getPipelineCreationBackendUrl()).resolves.toBe(
    window.location.origin,
  );
  expect(createsLocalPipelines()).toBe(false);
  expect(() => setBrowserPipelineStorage(true)).not.toThrow();
});
