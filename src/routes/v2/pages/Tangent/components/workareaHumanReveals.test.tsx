import type { EmbedAsset } from "@tangent/embed-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { AssetsWindowContent } from "./AssetsWindowContent";
import { ProjectChatArea } from "./ProjectChatArea";

let store: TangentProjectStore;
vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => store,
}));
vi.mock("@/hooks/useAiProviderSettings", () => ({
  useAiProviderSettings: () => ({ isConfigured: true }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/routes/v2/pages/Tangent/components/AgentTraceDialog", () => ({
  AgentTraceButton: () => null,
}));
vi.mock("@/routes/v2/pages/Tangent/components/AttachAgentButton", () => ({
  AttachAgentButton: () => null,
}));
vi.mock("@/routes/v2/pages/Tangent/components/TangentChatPane", () => ({
  TangentChatPane: ({
    onOpenArtifact,
  }: {
    onOpenArtifact: (url: string, title: string) => void;
  }) => (
    <button onClick={() => onOpenArtifact("artifact://report", "Report")}>
      Chat artifact
    </button>
  ),
}));
vi.mock("@tangent/embed-react", () => ({
  AssetList: ({ onOpen }: { onOpen: (asset: EmbedAsset) => void }) => (
    <button
      onClick={() =>
        onOpen({
          kind: "file",
          id: "file-1",
          url: "artifact://report",
          path: "report.json",
          title: "Report",
        })
      }
    >
      Asset report
    </button>
  ),
}));

beforeEach(() => {
  store = new TangentProjectStore("project-1");
  store.setDefaultSessionId("session-1");
  store.hideWorkarea();
});

describe("human artifact reveals", () => {
  it("reveals the workarea for a chat artifact click", () => {
    render(<ProjectChatArea />);
    fireEvent.click(screen.getByRole("button", { name: "Chat artifact" }));
    expect(store.workareaCollapsed).toBe(false);
    expect(store.workareaTabs).toHaveLength(1);
    expect(store.workareaTabs[0].title).toBe("Report");
  });

  it("reveals and selects an asset without duplicating its hidden agent-opened tab", () => {
    const tab = store.openArtifactTab("artifact://report", "Report");
    expect(store.workareaCollapsed).toBe(true);
    render(<AssetsWindowContent />);
    fireEvent.click(screen.getByRole("button", { name: "Asset report" }));
    expect(store.workareaCollapsed).toBe(false);
    expect(store.workareaTabs).toEqual([tab]);
    expect(store.selectedAssetId).toBe("file-1");
    expect(store.activeWorkareaTabId).toBe(tab.id);
  });
});
