import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkareaIdentity } from "./types";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  editor: vi.fn((_props: unknown) => null),
  draft: vi.fn(),
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

import "./pipelineKind";

import { getWorkareaKind } from "./registry";

function resolvePipelineTitle(
  identity: WorkareaIdentity,
): string | Promise<string> {
  const kind = getWorkareaKind("pipeline");
  if (!kind) throw new Error("pipeline kind is not registered");
  return kind.resolveTitle({ type: "pipeline", identity });
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
      const kind = getWorkareaKind("pipeline")!;
      const host = {
        isActive: true,
        projectId: "project-1",
        tabEnvironmentId: () => undefined,
        registerTabStore: vi.fn(),
        unregisterTabStore: vi.fn(),
        registerTabEnvironment: vi.fn(),
        unregisterTabEnvironment: vi.fn(),
        registerTabBridge: vi.fn(),
        unregisterTabBridge: vi.fn(),
      } as Parameters<typeof kind.render>[1];
      render(
        kind.render(
          {
            id: "tab-1",
            title: "Example",
            target: { type: "pipeline", identity },
          } as Parameters<typeof kind.render>[0],
          host,
        ),
      );
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
});

it("shows a recoverable message when an old draft target is unavailable", () => {
  mocks.draft.mockImplementationOnce(() => {
    throw new Error(
      "This draft is unavailable. Close this tab and create a new pipeline.",
    );
  });
  const kind = getWorkareaKind("pipeline")!;
  render(
    kind.render(
      {
        id: "missing",
        title: "Old draft",
        target: { type: "pipeline", identity: "draft/missing" },
      } as Parameters<typeof kind.render>[0],
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
      } as Parameters<typeof kind.render>[1],
    ),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Close this tab");
});
