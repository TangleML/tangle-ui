import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { registerWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type { WorkareaTab } from "@/routes/v2/pages/Tangent/workarea/types";
import { idIdentity } from "@/services/projects/resourceTarget";

import { DynamicWorkarea } from "./DynamicWorkarea";

const stores = vi.hoisted(() => ({
  project: undefined as TangentProjectStore | undefined,
}));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => stores.project,
}));

vi.mock("./ProjectDockPopover", () => ({ ProjectDockPopover: () => null }));

vi.mock("./CanvasEmptyState", () => ({
  CanvasEmptyState: () => <p>Nothing open yet</p>,
}));

// Stands in for the pipeline editor: a view that stays mounted once shown.
registerWorkareaKind({
  type: "pipeline",
  icon: "GitBranch",
  keepMounted: true,
  resolveTitle: () => "Pipeline",
  render: (tab, { sessionId }) => (
    <p>
      {tab.title} editor, {sessionId ?? "no chat"}
    </p>
  ),
});

function pipelineTab(id: string, title: string): WorkareaTab {
  return { id, title, target: { type: "pipeline", identity: idIdentity(id) } };
}

function renderWorkarea(store: TangentProjectStore) {
  stores.project = store;
  return render(<DynamicWorkarea />);
}

describe("DynamicWorkarea", () => {
  it("loads a tab the project came back with only once it's shown", async () => {
    const store = new TangentProjectStore("project-1", {
      tabs: [pipelineTab("t1", "Churn model"), pipelineTab("t2", "Forecast")],
      activeId: "t2",
    });

    renderWorkarea(store);

    expect(
      screen.getByRole("tab", { name: "Churn model" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Forecast editor/)).toBeInTheDocument();
    expect(screen.queryByText(/Churn model editor/)).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Churn model" }));

    expect(screen.getByText(/Churn model editor/)).toBeInTheDocument();
    expect(screen.getByText(/Forecast editor/)).toBeInTheDocument();
  });

  it("keeps what's open as the chat changes, and hands it the chat in view", () => {
    const store = new TangentProjectStore("project-1");
    store.setDefaultSessionId("chat-a");
    store.openResolvedView({
      title: "Churn model",
      target: { type: "pipeline", identity: idIdentity("p1") },
    });

    renderWorkarea(store);

    expect(screen.getByText("Churn model editor, chat-a")).toBeInTheDocument();

    act(() => store.selectSession("chat-b"));

    expect(screen.getByText("Churn model editor, chat-b")).toBeInTheDocument();
  });

  it("opens a tab with no chat in view", () => {
    const store = new TangentProjectStore("project-1");

    renderWorkarea(store);
    expect(screen.getByText("Nothing open yet")).toBeInTheDocument();

    act(() => {
      store.openResolvedView({
        title: "Churn model",
        target: { type: "pipeline", identity: idIdentity("p1") },
      });
    });

    expect(screen.getByText("Churn model editor, no chat")).toBeInTheDocument();
  });
});
