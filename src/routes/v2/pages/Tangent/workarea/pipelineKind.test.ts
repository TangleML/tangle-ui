import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmbeddedPipelineEditor } from "@/routes/v2/pages/Editor/EmbeddedPipelineEditor";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import type { WorkareaIdentity } from "./types";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  editor: vi.fn(
    (_props: ComponentProps<typeof EmbeddedPipelineEditor>) => null,
  ),
  draft: vi.fn(),
  replaceWorkareaTarget: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Editor/EmbeddedPipelineEditor", () => ({
  EmbeddedPipelineEditor: mocks.editor,
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.example.com",
    ready: true,
    configured: true,
  }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => ({ getRemoteDraftRef: mocks.draft }),
}));

vi.mock("@/services/pipelineStorage/pipelineRegistry", () => ({
  findById: mocks.findById,
}));
vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({
    replaceWorkareaTarget: mocks.replaceWorkareaTarget,
  }),
}));

import "./pipelineKind";

import { getWorkareaKind } from "./registry";

function resolvePipelineTitle(
  identity: WorkareaIdentity,
): string | Promise<string> {
  const kind = getWorkareaKind("pipeline");
  if (!kind) throw new Error("pipeline kind is not registered");
  return kind.resolveTitle({ type: "pipeline", identity });
}

function renderPipeline(identity: WorkareaIdentity) {
  const kind = getWorkareaKind("pipeline")!;
  render(
    kind.render(
      {
        id: "tab-1",
        title: "Example",
        target: { type: "pipeline", identity },
      },
      {
        isActive: true,
        projectId: "project-1",
        tabEnvironmentId: () => undefined,
        registerTabStore: vi.fn(),
        unregisterTabStore: vi.fn(),
        registerTabEnvironment: vi.fn(),
        unregisterTabEnvironment: vi.fn(),
        registerTabBridge: vi.fn(),
        unregisterTabBridge: vi.fn(),
      },
    ),
  );
}

describe("pipelineKind resolveTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the registry storageKey for an id target", async () => {
    mocks.findById.mockResolvedValue({ storageKey: "My Pipeline" });

    await expect(resolvePipelineTitle("id/abc")).resolves.toBe("My Pipeline");
    expect(mocks.findById).toHaveBeenCalledWith("abc");
  });

  it("falls back to the fileId when no registry entry exists", async () => {
    mocks.findById.mockResolvedValue(undefined);

    await expect(resolvePipelineTitle("id/abc")).resolves.toBe("abc");
  });

  it("uses the name for a name target without a registry lookup", async () => {
    await expect(resolvePipelineTitle("name/My Draft")).resolves.toBe(
      "My Draft",
    );
    expect(mocks.findById).not.toHaveBeenCalled();
  });

  it.each(["remote/pipeline-1", "draft/draft-1"] as const)(
    "opens %s with its backend identity",
    (identity) => {
      const draftRef = {
        source: "draft",
        backendUrl: "https://backend.example.com",
        draftId: "draft-1",
        name: "Draft",
      };
      mocks.draft.mockReturnValue(draftRef);
      renderPipeline(identity);
      const props = mocks.editor.mock.calls.at(-1)?.[0];
      expect(props).toMatchObject({
        pipelineRef: identity.startsWith("draft/")
          ? draftRef
          : {
              source: "remote",
              backendUrl: "https://backend.example.com",
              pipelineId: "pipeline-1",
            },
      });
      expect(mocks.findById).not.toHaveBeenCalled();
    },
  );

  it("replaces the local workarea target after migration", () => {
    renderPipeline("id/local-1");
    const props = mocks.editor.mock.calls.at(-1)?.[0];
    props?.onMigrated?.({
      id: "remote-1",
      remote: {
        backendUrl: "https://backend.example.com",
        pipelineId: "remote-1",
      },
    } as PipelineFile);
    expect(mocks.replaceWorkareaTarget).toHaveBeenCalledWith(
      { type: "pipeline", identity: "id/local-1" },
      { type: "pipeline", identity: "remote/remote-1" },
    );
  });
});
