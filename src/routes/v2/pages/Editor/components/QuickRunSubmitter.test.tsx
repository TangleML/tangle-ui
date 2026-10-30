import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RunsAndSubmissionWindowMiniContent } from "@/routes/v2/pages/Editor/components/RunsAndSubmissionWindowMiniContent";
import { CollapsedDockWindowMini } from "@/routes/v2/shared/windows/CollapsedDockWindowMini";

import { QuickRunSubmitter } from "./QuickRunSubmitter";
import { QuickRunSubmitterProvider } from "./QuickRunSubmitterContext";

const { dock } = vi.hoisted(() => ({
  dock: { mini: null as ReactNode, content: null as ReactNode },
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({
    navigation: {
      rootSpec: { allValidationIssues: [], inputs: [], isValid: true },
    },
    windows: {
      getWindowById: () => ({
        state: "docked",
        title: "Runs & Submissions",
        size: { width: 280, height: 50 },
      }),
      getWindowMiniContent: () => dock.mini,
      getWindowContent: () => dock.content,
    },
  }),
}));

vi.mock("@/models/componentSpec", () => ({
  serializeComponentSpec: () => ({ name: "Pipeline" }),
}));

vi.mock("@/components/shared/Authentication/useAwaitAuthorization", () => ({
  useAwaitAuthorization: () => ({ isAuthorized: true }),
}));

vi.mock("@/components/shared/Submitters/Tangle/TangleSubmitter", async () => {
  const { useState } = await import("react");
  const { Dialog, DialogContent, DialogDescription, DialogTitle } =
    await import("@/components/ui/dialog");

  return {
    default: function TangleSubmitter() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Submit pipeline
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Submit Run with Arguments</DialogTitle>
              <DialogDescription>Review the run</DialogDescription>
              <input aria-label="Run notes" />
            </DialogContent>
          </Dialog>
        </>
      );
    },
  };
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

describe("QuickRunSubmitter", () => {
  beforeEach(() => {
    dock.mini = <RunsAndSubmissionWindowMiniContent />;
    dock.content = <p>Runs and submissions panel</p>;
  });

  it("keeps the docked panel closed while you use a dialog it opens", async () => {
    const user = userEvent.setup();
    render(
      <QuickRunSubmitterProvider>
        <CollapsedDockWindowMini
          windowId="runs-and-submission"
          dockSide="left"
        />
        <QuickRunSubmitter />
      </QuickRunSubmitterProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Submit Run" }));
    const notes = await screen.findByRole("textbox", { name: "Run notes" });

    await user.click(notes);
    await user.keyboard("Retrain on new data");

    expect(notes).toHaveFocus();
    expect(notes).toHaveValue("Retrain on new data");
    expect(screen.queryByText("Runs and submissions panel")).toBeNull();
  });
});
