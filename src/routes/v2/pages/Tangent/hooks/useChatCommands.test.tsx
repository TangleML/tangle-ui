import type { EmbedCommand } from "@tangent/embed-react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";

import { useChatCommands } from "./useChatCommands";

const fakes = vi.hoisted(() => ({
  store: { activeSessionId: "chat-1" },
  listEntries: vi.fn(),
  listArchived: vi.fn(),
  listFiles: vi.fn(),
  resolvePipeline: vi.fn(),
  submit: vi.fn(),
  recordSessionRun: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => fakes.store,
}));
vi.mock("@/routes/v2/pages/Tangent/context/ProjectCardHandlersContext", () => ({
  useProjectCardHandlers: () => ({
    listEntries: fakes.listEntries,
    listArchived: fakes.listArchived,
    listFiles: fakes.listFiles,
  }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => ({ resolvePipeline: fakes.resolvePipeline }),
}));
vi.mock(
  "@/routes/v2/shared/components/AiChat/toolBridge/useLazyBridgeAuth",
  () => ({
    useLazyBridgeAuth: () => ({
      getBackendUrl: () => "https://backend.example",
      getAuthToken: () => "token",
      queryClient: undefined,
    }),
  }),
);
vi.mock("@/routes/v2/shared/components/AiChat/toolBridge/runBridge", () => ({
  createRunBridgeHandlers: (deps: BridgeDeps) => ({
    submitPipelineRun: () => fakes.submit(deps),
  }),
}));
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: async () => undefined,
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: () => ({ baseUrl: "https://tangent.example" }),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useSessionRuns", () => ({
  useRecordSessionRun: () => fakes.recordSessionRun,
}));
vi.mock("@/services/teams/useTeamForSubmission", () => ({
  useTeamForSubmission: () => ({ status: "none" }),
}));

const TRAIN = { target: "pipeline://remote/p-1", name: "Train", at: null };

function commandNamed(name: string): EmbedCommand {
  const { result } = renderHook(() => useChatCommands("project-1"));
  const command = result.current.find((candidate) => candidate.name === name);
  if (!command) throw new Error(`No /${name} command`);
  return command;
}

describe("useChatCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.store.activeSessionId = "chat-1";
    fakes.listEntries.mockResolvedValue({
      runs: [],
      pipelines: [TRAIN],
      documents: [],
    });
    fakes.listArchived.mockResolvedValue([]);
    fakes.resolvePipeline.mockResolvedValue({
      read: async () =>
        "name: Train\nimplementation:\n  graph:\n    tasks: {}\n",
    });
    fakes.recordSessionRun.mockResolvedValue(undefined);
  });

  it("lists the project's pipelines with the ids /run takes", async () => {
    const text = await commandNamed("pipelines").run("");

    expect(text).toContain("[Train](pipeline://remote/p-1) · id `p-1`");
  });

  it("starts each pipeline it's given, puts it in the chat, and reports the rest", async () => {
    fakes.submit.mockResolvedValue({ success: true, runId: "r-9" });

    const text = await commandNamed("run").run("[p-1, nope]");

    expect(fakes.resolvePipeline).toHaveBeenCalledWith({
      source: "remote",
      backendUrl: "https://backend.example",
      pipelineId: "p-1",
    });
    const [deps] = fakes.submit.mock.calls[0] as [BridgeDeps];
    expect(deps.getSpec()?.name).toBe("Train");
    expect(Object.values(deps.getRunAnnotations?.() ?? {})).toEqual(["true"]);
    expect(fakes.recordSessionRun).toHaveBeenCalledWith(
      "chat-1",
      "r-9",
      "Train",
    );
    expect(text).toContain("- [Train](run://id/r-9)");
    expect(text).toContain("- `nope`: not one of this project's pipelines");
  });

  it("reports why the backend didn't start a pipeline", async () => {
    fakes.submit.mockResolvedValue({
      success: false,
      error: "A required input has no value.",
    });

    const text = await commandNamed("run").run("p-1");

    expect(text).toContain("`p-1` (Train): A required input has no value.");
    expect(fakes.recordSessionRun).not.toHaveBeenCalled();
  });

  it("keeps a run with the chat that asked for it when another is opened meanwhile", async () => {
    const submitted = Promise.withResolvers<{
      success: boolean;
      runId: string;
    }>();
    fakes.submit.mockReturnValue(submitted.promise);

    const running = commandNamed("run").run("p-1");
    await vi.waitFor(() => expect(fakes.submit).toHaveBeenCalled());
    fakes.store.activeSessionId = "chat-2";
    submitted.resolve({ success: true, runId: "r-9" });
    await running;

    expect(fakes.recordSessionRun).toHaveBeenCalledWith(
      "chat-1",
      "r-9",
      "Train",
    );
  });

  it("reports a run as started even when the chat can't note it down", async () => {
    fakes.submit.mockResolvedValue({ success: true, runId: "r-9" });
    fakes.recordSessionRun.mockRejectedValue(new Error("Tangent is down"));

    const text = await commandNamed("run").run("p-1");

    expect(text).toContain("- [Train](run://id/r-9)");
    expect(text).not.toContain("Couldn't start");
  });

  it("marks files by the chat the command ran in, not one opened meanwhile", async () => {
    const listed = Promise.withResolvers<unknown[]>();
    fakes.listFiles.mockReturnValue(listed.promise);
    const file = (sessionId: string, path: string) => ({
      sessionId,
      path,
      title: path,
      addedAt: new Date("2026-11-09"),
      pinned: false,
    });

    const running = commandNamed("files").run("");
    fakes.store.activeSessionId = "chat-2";
    listed.resolve([
      file("chat-1", "artifacts/a.md"),
      file("chat-2", "artifacts/b.md"),
    ]);
    const text = await running;

    expect(text).toContain("- [artifacts/a.md](artifacts/a.md)");
    expect(text).toMatch(/- \[artifacts\/b\.md\]\(https:\S+\) · another chat/);
  });

  it("asks for ids when none are given", async () => {
    await expect(commandNamed("run").run("")).rejects.toThrow(/pipeline ids/);
    expect(fakes.submit).not.toHaveBeenCalled();
  });
});
