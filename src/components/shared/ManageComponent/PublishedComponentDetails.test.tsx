import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import { DialogContext } from "../Dialogs/dialog.context";
import { PublishedComponentDetails } from "./PublishedComponentDetails";

const mocks = vi.hoisted(() => ({
  closeDialog: vi.fn(),
  forceUpdateTasks: vi.fn(),
  openUpgradeComponentsWindow: vi.fn(),
}));

vi.mock("./hooks/useHasPublishedComponent", () => ({
  useHasPublishedComponent: () => ({ data: true }),
}));

vi.mock("./hooks/useOutdatedComponents", () => ({
  useOutdatedComponents: (components: HydratedComponentReference[]) => ({
    data: components.map((component) => [
      component,
      { ...component, digest: "newer-digest" },
    ]),
  }),
}));

vi.mock("./hooks/useForceUpdateTasks", () => ({
  useForceUpdateTasks: () => mocks.forceUpdateTasks,
}));

vi.mock("./ComponentUsageCount", () => ({
  ComponentUsageCount: () => null,
}));

vi.mock(
  "@/routes/v2/pages/Editor/components/UpgradeComponents/useUpgradeComponentsWindow",
  () => ({
    useUpgradeComponentsWindow: () => mocks.openUpgradeComponentsWindow,
  }),
);

const outdatedComponent: HydratedComponentReference = {
  digest: "outdated-digest",
  name: "Train model",
  spec: {
    name: "Train model",
    implementation: { container: { image: "python:3.12" } },
  },
  text: "name: Train model",
};

function DialogWrapper({ children }: { children: ReactNode }) {
  return (
    <DialogContext.Provider
      value={{ name: "component-details", close: mocks.closeDialog }}
    >
      {children}
    </DialogContext.Provider>
  );
}

function NewEditorDialogWrapper({ children }: { children: ReactNode }) {
  return (
    <SharedStoreProvider>
      <DialogWrapper>{children}</DialogWrapper>
    </SharedStoreProvider>
  );
}

describe("PublishedComponentDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the Upgrade Components window from a dialog outside any editor window", () => {
    render(<PublishedComponentDetails component={outdatedComponent} />, {
      wrapper: NewEditorDialogWrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Review tasks" }));

    expect(mocks.closeDialog).toHaveBeenCalledTimes(1);
    expect(mocks.openUpgradeComponentsWindow).toHaveBeenCalledTimes(1);
    expect(mocks.forceUpdateTasks).not.toHaveBeenCalled();
  });

  it("reviews tasks on the canvas overlay outside the new editor", () => {
    render(<PublishedComponentDetails component={outdatedComponent} />, {
      wrapper: DialogWrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Review tasks" }));

    expect(mocks.forceUpdateTasks).toHaveBeenCalledWith("outdated-digest");
    expect(mocks.openUpgradeComponentsWindow).not.toHaveBeenCalled();
  });

  it("hides Review tasks when read-only", () => {
    render(
      <PublishedComponentDetails component={outdatedComponent} readOnly />,
      { wrapper: NewEditorDialogWrapper },
    );

    expect(
      screen.queryByRole("button", { name: "Review tasks" }),
    ).not.toBeInTheDocument();
  });
});
