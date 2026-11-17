import "./artifactKind";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { idIdentity } from "@/services/projects/resourceTarget";

import { getWorkareaKind } from "./registry";
import type { WorkareaHostProps, WorkareaTab } from "./types";

vi.mock("@tangent/embed-react", () => ({
  ArtifactViewer: ({ sessionId, url }: { sessionId: string; url: string }) => (
    <p>
      {url} read as {sessionId}
    </p>
  ),
}));

const CHAT_FILE = "https://tangent.example/api/sessions/chat-a/files/report.md";

function renderArtifact(url: string, sessionId?: string) {
  const kind = getWorkareaKind("artifact");
  if (!kind) throw new Error("artifact kind is not registered");
  const tab: WorkareaTab = {
    id: "tab-1",
    title: "Report",
    target: { type: "artifact", identity: idIdentity(url) },
  };
  return render(<>{kind.render(tab, { sessionId } as WorkareaHostProps)}</>);
}

describe("artifactKind", () => {
  it("reads a chat's file as that chat's, whichever chat is in view", () => {
    renderArtifact(CHAT_FILE, "chat-b");

    expect(screen.getByText(`${CHAT_FILE} read as chat-a`)).toBeInTheDocument();
  });

  it("shows a chat's file with no chat in view", () => {
    renderArtifact(CHAT_FILE);

    expect(screen.getByText(`${CHAT_FILE} read as chat-a`)).toBeInTheDocument();
  });

  it("reads any other address as the chat in view's", () => {
    renderArtifact("https://example.com/page.html", "chat-b");

    expect(
      screen.getByText("https://example.com/page.html read as chat-b"),
    ).toBeInTheDocument();
  });

  it("asks for a session when an address names none and none is in view", () => {
    renderArtifact("https://example.com/page.html");

    expect(
      screen.getByText("Start a session to view this artifact."),
    ).toBeInTheDocument();
  });
});
