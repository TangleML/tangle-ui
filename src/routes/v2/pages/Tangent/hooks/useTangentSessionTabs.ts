import type { EmbedAgent, EmbedAsset } from "@tangent/embed-react";
import { useState } from "react";

export const CHAT_TAB_VALUE = "chat";

/** Matches Tangent's Prime agent id (`PI_AGENT.id`) without depending on `@tangent/shared`. */
export const PRIME_AGENT_ID = "prime";

export interface AgentTab {
  id: string;
  title: string;
}

interface SessionTabState {
  tabs: AgentTab[];
  activeTab: string;
  selectedAssetId?: string;
}

const EMPTY_SESSION_TABS: SessionTabState = {
  tabs: [],
  activeTab: CHAT_TAB_VALUE,
};

export function useTangentSessionTabs(sessionId: string | undefined) {
  const [bySession, setBySession] = useState<Record<string, SessionTabState>>(
    {},
  );

  const current =
    (sessionId ? bySession[sessionId] : undefined) ?? EMPTY_SESSION_TABS;

  function updateSession(update: (prev: SessionTabState) => SessionTabState) {
    if (!sessionId) return;
    setBySession((prev) => ({
      ...prev,
      [sessionId]: update(prev[sessionId] ?? EMPTY_SESSION_TABS),
    }));
  }

  function openAgent(agent: EmbedAgent) {
    if (agent.kind === "prime") {
      updateSession((prev) => ({ ...prev, activeTab: CHAT_TAB_VALUE }));
      return;
    }

    updateSession((prev) => ({
      ...prev,
      tabs: prev.tabs.some((tab) => tab.id === agent.id)
        ? prev.tabs
        : [...prev.tabs, { id: agent.id, title: agent.name }],
      activeTab: agent.id,
    }));
  }

  function closeTab(id: string) {
    updateSession((prev) => ({
      ...prev,
      tabs: prev.tabs.filter((tab) => tab.id !== id),
      activeTab: prev.activeTab === id ? CHAT_TAB_VALUE : prev.activeTab,
    }));
  }

  function selectAsset(asset: EmbedAsset) {
    updateSession((prev) => ({ ...prev, selectedAssetId: asset.id }));
  }

  function setActiveTab(value: string) {
    updateSession((prev) => ({ ...prev, activeTab: value }));
  }

  function dropSession(id: string) {
    setBySession((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  const selectedAgentId =
    current.activeTab === CHAT_TAB_VALUE ? PRIME_AGENT_ID : current.activeTab;

  return {
    tabs: current.tabs,
    activeTab: current.activeTab,
    selectedAgentId,
    selectedAssetId: current.selectedAssetId,
    openAgent,
    closeTab,
    selectAsset,
    setActiveTab,
    dropSession,
  };
}
