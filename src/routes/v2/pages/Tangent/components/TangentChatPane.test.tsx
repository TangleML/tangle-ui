import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CHAT_TAB_VALUE } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { TangentChatPane } from "./TangentChatPane";

vi.mock("@tangent/embed-react", () => ({
  Chat: ({
    agentId,
    autoFocus,
    onResourcesChange,
  }: {
    agentId?: string;
    autoFocus?: boolean;
    onResourcesChange?: () => void;
  }) => (
    <tangent-chat
      data-testid={agentId ? `chat-${agentId}` : "chat-prime"}
      data-autofocus={String(Boolean(autoFocus))}
      onClick={() => onResourcesChange?.()}
    />
  ),
}));

const noop = () => undefined;

function renderPane(
  activeTab = CHAT_TAB_VALUE,
  onResourcesChange: () => void = noop,
) {
  return render(
    <TangentChatPane
      sessionId="sess-1"
      tabs={[{ id: "agent-1", title: "Architect" }]}
      activeTab={activeTab}
      onTabChange={noop}
      onCloseTab={noop}
      onResourcesChange={onResourcesChange}
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

  it("shares each tab's messages and sends the target only to the visible transcript", () => {
    const props = {
      projectId: "p",
      sessionId: "s",
      tabs: [{ id: "a", title: "Researcher" }],
      onTabChange: noop,
      onCloseTab: noop,
      message: { agentId: "a", messageId: "m" },
    };
    const { rerender } = render(
      <TangentChatPane {...props} activeTab={CHAT_TAB_VALUE} />,
    );
    const prime = screen.getByTestId("chat-prime");
    const agent = screen.getByTestId("chat-a");
    expect(prime).toHaveProperty("targetAgentId", "a");
    expect(prime).toHaveProperty("targetMessageId", undefined);
    expect(agent).toHaveProperty("targetMessageId", undefined);
    expect(prime).toHaveAttribute("data-autofocus", "false");

    rerender(<TangentChatPane {...props} activeTab="a" />);
    expect(agent).toHaveProperty("targetMessageId", "m");
    const primeLink = Reflect.get(prime, "getMessageLink")("m");
    const agentLink = Reflect.get(agent, "getMessageLink")("m");
    expect(primeLink).toBe(
      `${window.location.origin}/tangent/p?session=s&message=m`,
    );
    expect(agentLink).toBe(`${primeLink}&agent=a`);

    rerender(
      <TangentChatPane
        {...props}
        message={{ messageId: "prime-message" }}
        activeTab={CHAT_TAB_VALUE}
      />,
    );
    expect(prime).toHaveProperty("targetAgentId", undefined);
    expect(prime).toHaveProperty("targetMessageId", "prime-message");
    expect(agent).toHaveProperty("targetMessageId", undefined);
  });

  it("hears of a change once, from Prime's chat, when every chat of the session reports it", () => {
    const onResourcesChange = vi.fn();
    renderPane("agent-1", onResourcesChange);

    fireEvent.click(screen.getByTestId("chat-prime"));
    fireEvent.click(screen.getByTestId("chat-agent-1"));

    expect(onResourcesChange).toHaveBeenCalledTimes(1);
  });
});
