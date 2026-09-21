import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CHAT_TAB_VALUE } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { TangentChatPane } from "./TangentChatPane";

vi.mock("@tangent/embed-react", () => ({
  Chat: ({ agentId, autoFocus }: { agentId?: string; autoFocus?: boolean }) => (
    <div
      data-testid={agentId ? `chat-${agentId}` : "chat-prime"}
      data-autofocus={String(Boolean(autoFocus))}
    />
  ),
}));

const noop = () => undefined;

function renderPane(activeTab = CHAT_TAB_VALUE) {
  return render(
    <TangentChatPane
      sessionId="sess-1"
      tabs={[{ id: "agent-1", title: "Architect" }]}
      activeTab={activeTab}
      onTabChange={noop}
      onCloseTab={noop}
    />,
  );
}

describe("TangentChatPane", () => {
  /** A session opens for someone to type in, so the composer takes the caret. */
  it("hands the caret to the session composer", () => {
    renderPane();

    expect(screen.getByTestId("chat-prime")).toHaveAttribute(
      "data-autofocus",
      "true",
    );
  });

  /**
   * Opening a sub-agent's tab is navigation, not an invitation to type, and the
   * caret may well be somewhere the person put it on purpose.
   */
  it("leaves the caret alone when a sub-agent tab mounts", () => {
    renderPane("agent-1");

    expect(screen.getByTestId("chat-agent-1")).toHaveAttribute(
      "data-autofocus",
      "false",
    );
  });
});
