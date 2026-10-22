import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmbeddedPipelineEditor } from "@/routes/v2/pages/Editor/EmbeddedPipelineEditor";
import type { PipelineTarget } from "@/services/projects/resourceTarget";

const mocks = vi.hoisted(() => ({
  editor: vi.fn(
    (_props: ComponentProps<typeof EmbeddedPipelineEditor>) => null,
  ),
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

import "./pipelineKind";

import { getWorkareaKind } from "./registry";

function resolvePipelineTitle(
  identity: PipelineTarget["identity"],
): string | Promise<string> {
  const kind = getWorkareaKind("pipeline");
  if (!kind) throw new Error("pipeline kind is not registered");
  return kind.resolveTitle({ type: "pipeline", identity });
}

function renderPipeline(identity: PipelineTarget["identity"]) {
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

  it.each(["remote/pipeline-1", "draft/draft-1"] as const)(
    "uses the target identity for %s until the caller supplies a title",
    async (identity) => {
      expect(await resolvePipelineTitle(identity)).toBe(identity.split("/")[1]);
    },
  );

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
