import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDefaultEditorPath, getEditorLocation } from "./editorRoutes";

const options = vi.hoisted(() => ({ remote: false, v2: false }));

vi.mock("@/utils/remotePipelines", () => ({
  get REMOTE_PIPELINES_ENABLED() {
    return options.remote;
  },
}));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: () => options.v2,
}));

beforeEach(() => Object.assign(options, { remote: false, v2: false }));

describe("getDefaultEditorPath", () => {
  it("preserves the editor preference for local-only deployments", () => {
    expect(getDefaultEditorPath("Local pipeline")).toBe(
      "/editor/Local%20pipeline",
    );
    options.v2 = true;
    expect(getDefaultEditorPath("Local pipeline")).toBe(
      "/editor-v2/Local%20pipeline",
    );
  });

  it("uses the remote-capable editor for all pipelines when enabled", () => {
    options.remote = true;
    expect(getDefaultEditorPath("Local pipeline")).toBe(
      "/editor-v2/Local%20pipeline",
    );
  });

  it("uses only the remote ID in the editor URL", () => {
    expect(
      getDefaultEditorPath(
        "remote:http%3A%2F%2Flocalhost%3A8000:8496decf-1b93-4414-a0a0-6c8faae3eeb1",
      ),
    ).toBe("/editor-v2/8496decf-1b93-4414-a0a0-6c8faae3eeb1");
  });

  it("retains scoped links for a favorite belonging to a different backend", () => {
    const referenceId = "remote:https%3A%2F%2Fserver.example:pipeline-id";
    expect(getDefaultEditorPath(referenceId, "https://server.example/")).toBe(
      "/editor-v2/pipeline-id",
    );
    expect(getDefaultEditorPath(referenceId, "https://other.example")).toBe(
      `/editor-v2/${encodeURIComponent(referenceId)}`,
    );
  });

  it("preserves pending routes until a remote ID exists", () => {
    const referenceId = "pending:server:local-id";
    expect(getDefaultEditorPath(referenceId)).toBe(
      `/editor-v2/${encodeURIComponent(referenceId)}`,
    );
  });
});

describe("getEditorLocation", () => {
  it("retains the local name and local registry ID", () => {
    expect(
      getEditorLocation({
        referenceId: "Local pipeline",
        id: "local-id",
        storageKind: "local",
      }),
    ).toEqual({
      to: "/editor-v2/$pipelineName",
      params: { pipelineName: "Local pipeline" },
      search: { fileId: "local-id" },
    });
  });

  it("removes scoped references from both the path and query for remote files", () => {
    expect(
      getEditorLocation({
        referenceId: "remote:server:pipeline-id",
        id: "remote:server:pipeline-id",
        storageKind: "remote",
      }),
    ).toEqual({
      to: "/editor-v2/$pipelineName",
      params: { pipelineName: "pipeline-id" },
      search: {},
    });
  });

  it("recognizes remote references from file pickers and imports", () => {
    expect(
      getEditorLocation({
        name: "Pipeline title",
        fileId: "remote:server:pipeline-id",
      }),
    ).toEqual({
      to: "/editor-v2/$pipelineName",
      params: { pipelineName: "pipeline-id" },
      search: {},
    });
  });

  it("retains local picker names and pending identities", () => {
    expect(
      getEditorLocation({ name: "Local pipeline", fileId: "local-id" }),
    ).toEqual({
      to: "/editor-v2/$pipelineName",
      params: { pipelineName: "Local pipeline" },
      search: { fileId: "local-id" },
    });
    expect(
      getEditorLocation({
        name: "Pending pipeline",
        fileId: "pending:server:local-id",
      }),
    ).toEqual({
      to: "/editor-v2/$pipelineName",
      params: { pipelineName: "pending:server:local-id" },
      search: {},
    });
  });
});
