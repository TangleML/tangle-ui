import { act, fireEvent, render, screen } from "@testing-library/react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import type {
  WorkareaHostProps,
  WorkareaTab,
} from "@/routes/v2/pages/Tangent/workarea/types";
import { idIdentity } from "@/services/projects/resourceTarget";

import { CollapsedWorkareaRail } from "./CollapsedWorkareaRail";
import { DynamicWorkarea } from "./DynamicWorkarea";

let store: TangentProjectStore;
const unmounted = vi.fn();
const listening = new Map<string, boolean>();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => store,
}));
vi.mock("@/routes/v2/pages/Tangent/workarea/registry", () => ({
  registerWorkareaKind: vi.fn(),
  getWorkareaKind: () => ({
    icon: "FileText",
    keepMounted: true,
    render: (tab: WorkareaTab, host: WorkareaHostProps) => (
      <TestView tab={tab} host={host} />
    ),
  }),
}));

// Stands in for an editor's shortcut listener, which follows `isActive`.
function TestView({
  tab,
  host,
}: {
  tab: WorkareaTab;
  host: WorkareaHostProps;
}) {
  listening.set(tab.title, host.isActive);
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

const Workarea = observer(function Workarea() {
  return (
    <>
      <DynamicWorkarea />
      {store.workareaCollapsed && <CollapsedWorkareaRail />}
    </>
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  listening.clear();
  store = new TangentProjectStore("project-1");
  store.setDefaultSessionId("session-1");
});

describe("collapsing the workarea to its rail", () => {
  it("keeps the open view's work while collapsed and reopens on its tab", () => {
    open("First");
    open("Second");
    render(<Workarea />);
    const first = screen.getByTestId("view-First");
    fireEvent.change(first, { target: { value: "edited canvas" } });
    first.focus();

    act(() => store.hideWorkarea());
    expect(first).not.toBeVisible();
    expect(listening.get("Second")).toBe(false);
    expect(screen.getByRole("button", { name: "Show workarea" })).toHaveFocus();
    expect(unmounted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show First" }));
    expect(first).toBeVisible();
    expect(first).toHaveValue("edited canvas");
    expect(listening.get("First")).toBe(true);
  });

  it("reopens when the rail's edge is double-clicked", () => {
    open("Pipeline");
    store.hideWorkarea();
    render(<Workarea />);

    fireEvent.doubleClick(
      screen.getByRole("separator", { name: "Expand workarea" }),
    );

    expect(screen.getByTestId("view-Pipeline")).toBeVisible();
  });

  it("opens an agent's new tab while collapsed without reopening or taking focus", () => {
    store.hideWorkarea();
    render(
      <>
        <input aria-label="Chat composer" />
        <Workarea />
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
