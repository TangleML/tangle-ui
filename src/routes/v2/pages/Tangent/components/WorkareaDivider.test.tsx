import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { WorkareaDivider } from "./WorkareaDivider";

let store: TangentProjectStore;
const resize = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => store,
}));

const MAX_CHAT = 760;

function renderDivider() {
  render(
    <div>
      <WorkareaDivider
        rowMeasured
        maxChatWidth={MAX_CHAT}
        onResize={resize}
        onCollapsePreview={vi.fn()}
      />
    </div>,
  );
  return screen.getByRole("separator", { name: "Resize workarea" });
}

// jsdom has no layout, so a drag starts from a 0px-wide chat pane and the
// pointer's x position is the width the user is asking for.
function dragTo(divider: HTMLElement, x: number) {
  fireEvent.mouseDown(divider, { clientX: 0 });
  fireEvent.mouseMove(document, { clientX: x });
  fireEvent.mouseUp(document, { clientX: x });
}

beforeEach(() => {
  vi.clearAllMocks();
  store = new TangentProjectStore("project-1");
});

describe("chat/workarea divider", () => {
  it("collapses the workarea on double-click", () => {
    fireEvent.doubleClick(renderDivider());

    expect(store.workareaCollapsed).toBe(true);
  });

  it("snaps the workarea shut when dragged past where it stops", () => {
    dragTo(renderDivider(), MAX_CHAT + 40);

    expect(store.workareaCollapsed).toBe(true);
    expect(resize).not.toHaveBeenCalled();
  });

  it("only resizes the chat on a shorter drag", () => {
    dragTo(renderDivider(), 600);

    expect(store.workareaCollapsed).toBe(false);
    expect(resize).toHaveBeenCalledWith(600);
  });
});
