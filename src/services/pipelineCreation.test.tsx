import "fake-indexeddb/auto";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import {
  ComponentSpecProvider,
  useComponentSpec,
} from "@/providers/ComponentSpecProvider";
import {
  getComponentFileFromList,
  writeComponentToFileListFromText,
} from "@/utils/componentStore";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { copyRunToPipeline } from "./pipelineRunService";
import { importPipelineFromYaml, useSavePipeline } from "./pipelineService";
import type { SavedPipelineDocument } from "./pipelineSpecService";
import {
  createPipelineFromContent,
  getPipelineCreationBackendUrl,
} from "./pipelineStorage/pipelineCreation";
import { PipelineStorageService } from "./pipelineStorage/PipelineStorageService";
import { editorSpecFromRemoteTask } from "./pipelineStorage/remotePipelineTask";

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
  writeComponentToFileListFromText: vi.fn(),
}));
vi.mock("@/api/client.gen", () => ({ client: { put: vi.fn() } }));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: () => true,
}));
vi.mock("./pipelineStorage/createDriver", () => ({ createDriver: () => ({}) }));

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
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  Object.assign(settings, {
    apiUrl: "",
    useEnv: true,
    relative: true,
    userUrl: "",
  });
  vi.mocked(getComponentFileFromList).mockResolvedValue(null);
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

it.each([undefined, "false", "true"])(
  "uses the deployment policy for imports, copies, and run clones (%s)",
  async (override) => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", override);
    const local = override === "true";
    const results = [
      await importPipelineFromYaml(componentSpecToYaml(spec)),
      await useSavePipeline(spec).savePipeline("Copy"),
      await copyRunToPipeline(spec, "run-7", "Clone", { greeting: "after" }),
    ];
    expect(writeComponentToFileListFromText).toHaveBeenCalledTimes(
      local ? 3 : 0,
    );
    expect(client.put).toHaveBeenCalledTimes(local ? 0 : 3);
    const specs = local
      ? vi
          .mocked(writeComponentToFileListFromText)
          .mock.calls.map((call) => componentSpecFromYaml(String(call[2])))
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
        expect(result?.url).toBe(`/editor-v2/remote/${remoteId}`);
  },
);

it("keeps local collision handling and existing local edits", async () => {
  vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
  vi.mocked(getComponentFileFromList)
    .mockResolvedValueOnce({} as never)
    .mockResolvedValueOnce({} as never);
  expect(await importPipelineFromYaml(componentSpecToYaml(spec))).toMatchObject(
    { name: "Example (1)", successful: true },
  );
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  vi.mocked(getComponentFileFromList).mockResolvedValue({} as never);
  await useSavePipeline(spec).savePipeline();
  expect(writeComponentToFileListFromText).toHaveBeenCalledTimes(2);
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

it.each(["remote", "existing local", "local override", "read-only"])(
  "saves legacy editor content: %s",
  async (mode) => {
    if (mode === "existing local")
      vi.mocked(getComponentFileFromList).mockResolvedValue({} as never);
    if (mode === "local override") vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
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
    expect(writeComponentToFileListFromText).toHaveBeenCalledTimes(
      mode.includes("local") ? 2 : 0,
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
  },
);

it.each(["backend configuration", "remote response"])(
  "reports %s failure without a local fallback",
  async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (failure === "backend configuration") settings.relative = false;
    else vi.mocked(client.put).mockRejectedValueOnce(new Error("Unavailable"));
    expect(
      await importPipelineFromYaml(componentSpecToYaml(spec)),
    ).toMatchObject({ successful: false });
    expect(writeComponentToFileListFromText).not.toHaveBeenCalled();
  },
);
