import "./artifactKind";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getWorkareaKind } from "./registry";
import type { WorkareaHostProps, WorkareaTab } from "./types";

vi.mock("@tangent/embed-react", () => ({
  ArtifactViewer: ({ url }: { url: string }) => (
    <div data-testid="artifact-viewer" data-url={url} />
  ),
}));

vi.mock("./TextArtifactView", () => ({
  TextArtifactView: ({ url, title }: { url: string; title: string }) => (
    <div data-testid="text-artifact-view" data-url={url}>
      {title}
    </div>
  ),
}));

const FILES = "https://tangent.example/api/sessions/s1/files/artifacts";

function artifactTab(url: string): WorkareaTab {
  return {
    id: "tab-1",
    title: "Asset",
    target: { type: "artifact", identity: `id/${url}` },
  };
}

function renderArtifact(url: string, sessionId?: string) {
  const kind = getWorkareaKind("artifact");
  if (!kind) throw new Error("artifact kind is not registered");
  return render(
    <>
      {kind.render(artifactTab(url), {
        projectId: "project-1",
        sessionId,
      } as WorkareaHostProps)}
    </>,
  );
}

describe("artifactKind", () => {
  afterEach(() => vi.resetAllMocks());

  it("opens a text asset in the code viewer", () => {
    renderArtifact(`${FILES}/query.sql`, "s1");

    expect(screen.getByTestId("text-artifact-view")).toHaveAttribute(
      "data-url",
      `${FILES}/query.sql`,
    );
    expect(screen.queryByTestId("artifact-viewer")).not.toBeInTheDocument();
  });

  it("opens a text asset without an active session", () => {
    renderArtifact(`${FILES}/train.py`);

    expect(screen.getByTestId("text-artifact-view")).toBeInTheDocument();
  });

  it("keeps the embedded viewer for pages", () => {
    renderArtifact(`${FILES}/report.html`, "s1");

    expect(screen.getByTestId("artifact-viewer")).toHaveAttribute(
      "data-url",
      `${FILES}/report.html`,
    );
    expect(screen.queryByTestId("text-artifact-view")).not.toBeInTheDocument();
  });
});
