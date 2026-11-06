import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import type { WorkareaTab } from "@/routes/v2/pages/Tangent/workarea/types";
import { idIdentity } from "@/services/projects/resourceTarget";

import { DynamicWorkarea } from "./DynamicWorkarea";
import { WorkareaToggle } from "./ProjectHeader";

let store: TangentProjectStore;
const unmounted = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => store,
}));
vi.mock("@/routes/v2/pages/Tangent/workarea/registry", () => ({
  registerWorkareaKind: vi.fn(),
  getWorkareaKind: () => ({
    icon: "FileText",
    keepMounted: true,
    render: (tab: WorkareaTab) => <TestView tab={tab} />,
  }),
}));

function TestView({ tab }: { tab: WorkareaTab }) {
  useEffect(() => () => unmounted(tab.id), [tab.id]);
  return (
    <input data-testid={`view-${tab.title}`} defaultValue="work in progress" />
  );
}

function open(title: string) {
  return store.openResolvedView({
    title,
    target: { type: "pipeline", identity: idIdentity(title) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  store = new TangentProjectStore("project-1");
  store.setDefaultSessionId("session-1");
});

describe("hiding and showing the workarea", () => {
  it("hides the open view and brings it back with its work intact", () => {
    open("Pipeline");
    render(
      <>
        <WorkareaToggle />
        <DynamicWorkarea />
      </>,
    );
    const view = screen.getByTestId("view-Pipeline");
    fireEvent.change(view, { target: { value: "edited canvas" } });

    fireEvent.click(screen.getByRole("button", { name: "Hide workarea" }));
    expect(view).not.toBeVisible();
    expect(unmounted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show workarea" }));
    expect(view).toBeVisible();
    expect(view).toHaveValue("edited canvas");
  });

  it("opens an agent's new tab while hidden without revealing it or taking focus", () => {
    store.hideWorkarea();
    render(
      <>
        <input aria-label="Chat composer" />
        <DynamicWorkarea />
      </>,
    );
    const composer = screen.getByLabelText("Chat composer");
    composer.focus();

    act(() => {
      open("Agent pipeline");
    });

    expect(screen.getByTestId("view-Agent pipeline")).not.toBeVisible();
    expect(composer).toHaveFocus();
  });
});
