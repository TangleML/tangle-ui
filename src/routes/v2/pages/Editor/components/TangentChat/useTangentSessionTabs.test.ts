import type { EmbedAgent } from "@tangent/embed-react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CHAT_TAB_VALUE,
  PRIME_AGENT_ID,
  useTangentSessionTabs,
} from "./useTangentSessionTabs";

const prime: EmbedAgent = {
  id: PRIME_AGENT_ID,
  name: "Prime",
  kind: "prime",
  status: "active",
  conversationId: "conv-prime",
};

const researcher: EmbedAgent = {
  id: "agent-1",
  name: "Researcher",
  kind: "subagent",
  status: "active",
  conversationId: "conv-1",
};

const builder: EmbedAgent = {
  id: "agent-2",
  name: "Builder",
  kind: "subagent",
  status: "active",
  conversationId: "conv-2",
};

describe("useTangentSessionTabs", () => {
  it("starts on the Chat tab with Prime selected and no agent tabs", () => {
    const { result } = renderHook(() => useTangentSessionTabs());

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTab).toBe(CHAT_TAB_VALUE);
    expect(result.current.selectedAgentId).toBe(PRIME_AGENT_ID);
  });

  it("focuses Chat and does not add a tab when Prime is opened", () => {
    const { result } = renderHook(() => useTangentSessionTabs());

    act(() => {
      result.current.openAgent(researcher);
    });
    act(() => {
      result.current.openAgent(prime);
    });

    expect(result.current.tabs).toEqual([
      { id: researcher.id, title: researcher.name },
    ]);
    expect(result.current.activeTab).toBe(CHAT_TAB_VALUE);
    expect(result.current.selectedAgentId).toBe(PRIME_AGENT_ID);
  });

  it("adds a tab and focuses it when a sub-agent is opened", () => {
    const { result } = renderHook(() => useTangentSessionTabs());

    act(() => {
      result.current.openAgent(researcher);
    });

    expect(result.current.tabs).toEqual([
      { id: researcher.id, title: researcher.name },
    ]);
    expect(result.current.activeTab).toBe(researcher.id);
    expect(result.current.selectedAgentId).toBe(researcher.id);
  });

  it("focuses an existing tab without duplicating it", () => {
    const { result } = renderHook(() => useTangentSessionTabs());

    act(() => {
      result.current.openAgent(researcher);
    });
    act(() => {
      result.current.openAgent(builder);
    });
    act(() => {
      result.current.openAgent(researcher);
    });

    expect(result.current.tabs).toEqual([
      { id: researcher.id, title: researcher.name },
      { id: builder.id, title: builder.name },
    ]);
    expect(result.current.activeTab).toBe(researcher.id);
  });

  it("falls back to Chat when the active tab is closed", () => {
    const { result } = renderHook(() => useTangentSessionTabs());

    act(() => {
      result.current.openAgent(researcher);
    });
    act(() => {
      result.current.closeTab(researcher.id);
    });

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTab).toBe(CHAT_TAB_VALUE);
    expect(result.current.selectedAgentId).toBe(PRIME_AGENT_ID);
  });

  it("leaves the active tab unchanged when an inactive tab is closed", () => {
    const { result } = renderHook(() => useTangentSessionTabs());

    act(() => {
      result.current.openAgent(researcher);
    });
    act(() => {
      result.current.openAgent(builder);
    });
    act(() => {
      result.current.closeTab(researcher.id);
    });

    expect(result.current.tabs).toEqual([
      { id: builder.id, title: builder.name },
    ]);
    expect(result.current.activeTab).toBe(builder.id);
  });

  it("drops a removed agent tab and falls back to Chat when it was active", () => {
    const { result } = renderHook(() => useTangentSessionTabs());

    act(() => {
      result.current.openAgent(researcher);
    });
    act(() => {
      result.current.openAgent(builder);
    });
    act(() => {
      result.current.closeTab(builder.id);
    });

    expect(result.current.tabs).toEqual([
      { id: researcher.id, title: researcher.name },
    ]);
    expect(result.current.activeTab).toBe(CHAT_TAB_VALUE);
  });
});
