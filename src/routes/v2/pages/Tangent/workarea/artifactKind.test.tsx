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

const TANGENT = "https://tangent.example";
const SHARED_FILE = "https://tangent.example/api/sessions/chat-a/shared.md";

function renderArtifact(
  url: string,
  sessionId?: string,
  tangentBaseUrl: string | null = TANGENT,
) {
  const kind = getWorkareaKind("artifact");
  if (!kind) throw new Error("artifact kind is not registered");
  const tab: WorkareaTab = {
    id: "tab-1",
    title: "Report",
    target: { type: "artifact", identity: idIdentity(url) },
  };
  return render(
    <>{kind.render(tab, { sessionId, tangentBaseUrl } as WorkareaHostProps)}</>,
  );
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

  it("reads this Tangent's other addresses as the chat in view's", () => {
    renderArtifact(SHARED_FILE, "chat-b");

    expect(
      screen.getByText(`${SHARED_FILE} read as chat-b`),
    ).toBeInTheDocument();
  });

  it("asks for a session when an address names none and none is in view", () => {
    renderArtifact(SHARED_FILE);

    expect(
      screen.getByText("Start a session to view this artifact."),
    ).toBeInTheDocument();
  });

  it.each([
    "https://example.com/page.html",
    "https://evil.example/api/sessions/chat-a/files/report.md",
    "javascript:alert(1)",
  ])("doesn't load %s, which isn't this Tangent's", (url) => {
    renderArtifact(url, "chat-b");

    expect(
      screen.getByText(/isn't from one of this project's chats/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/read as/)).toBeNull();
  });

  it("loads nothing while it doesn't know which Tangent is this project's", () => {
    renderArtifact(CHAT_FILE, "chat-a", null);

    expect(screen.queryByText(/read as/)).toBeNull();
  });
});
