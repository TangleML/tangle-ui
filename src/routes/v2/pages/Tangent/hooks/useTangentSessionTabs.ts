import type { EmbedAgent, EmbedAsset } from "@tangent/embed-react";
import { useState } from "react";

export const CHAT_TAB_VALUE = "chat";

/** Matches Tangent's Prime agent id (`PI_AGENT.id`) without depending on `@tangent/shared`. */
export const PRIME_AGENT_ID = "prime";

export interface AgentTab {
  id: string;
  title: string;
}

export function useTangentSessionTabs() {
  const [tabs, setTabs] = useState<AgentTab[]>([]);
  const [activeTab, setActiveTab] = useState(CHAT_TAB_VALUE);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();

  function openAgent(agent: EmbedAgent) {
    if (agent.kind === "prime") {
      setActiveTab(CHAT_TAB_VALUE);
      return;
    }

    setTabs((prev) =>
      prev.some((tab) => tab.id === agent.id)
        ? prev
        : [...prev, { id: agent.id, title: agent.name }],
    );
    setActiveTab(agent.id);
  }

  function closeTab(id: string) {
    setTabs((prev) => prev.filter((tab) => tab.id !== id));
    setActiveTab((prev) => (prev === id ? CHAT_TAB_VALUE : prev));
  }

  function selectAsset(asset: EmbedAsset) {
    setSelectedAssetId(asset.id);
  }

  function resetTabs() {
    setTabs([]);
    setActiveTab(CHAT_TAB_VALUE);
    setSelectedAssetId(undefined);
  }

  const selectedAgentId =
    activeTab === CHAT_TAB_VALUE ? PRIME_AGENT_ID : activeTab;

  return {
    tabs,
    activeTab,
    selectedAgentId,
    selectedAssetId,
    openAgent,
    closeTab,
    selectAsset,
    setActiveTab,
    resetTabs,
  };
}
