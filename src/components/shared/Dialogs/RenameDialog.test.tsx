import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { DialogCancelledError } from "@/providers/DialogProvider/types";

import { RenameDialog, type RenameDialogProps } from "./RenameDialog";

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const track = vi.fn();
const resolved = vi.fn();
const rejected = vi.fn();

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const defaults: RenameDialogProps = {
  title: "Rename Project",
  description: "Give this project a different name.",
  currentName: "Churn model",
  trackingPrefix: "projects.rename_project",
};

function Opener({ props }: { props: RenameDialogProps }) {
  const { open } = useDialog();

  return (
    <button
      onClick={() =>
        void open<string, RenameDialogProps>({
          component: RenameDialog,
          props,
        }).then(resolved, rejected)
      }
    >
      Open
    </button>
  );
}

async function openDialog(overrides: Partial<RenameDialogProps> = {}) {
  const user = userEvent.setup();
  render(
    <DialogProvider disableRouterSync>
      <Opener props={{ ...defaults, ...overrides }} />
    </DialogProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Open" }));
  return user;
}

const nameField = () => screen.getByLabelText("Name");
const renameButton = () => screen.getByRole("button", { name: "Rename" });

describe("RenameDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens on the name it was given", async () => {
    await openDialog();

    expect(nameField()).toHaveValue("Churn model");
  });

  it("offers a placeholder when there is no name yet", async () => {
    await openDialog({ currentName: "", placeholder: "Session 1" });

    expect(nameField()).toHaveValue("");
    expect(nameField()).toHaveAttribute("placeholder", "Session 1");
  });

  it("resolves the name that was typed", async () => {
    const user = await openDialog();

    await user.clear(nameField());
    await user.type(nameField(), "Churn model v2");
    await user.click(renameButton());

    await waitFor(() =>
      expect(resolved).toHaveBeenCalledWith("Churn model v2"),
    );
  });

  it("trims the name it resolves", async () => {
    const user = await openDialog();

    await user.clear(nameField());
    await user.type(nameField(), "  Spaced out  ");
    await user.click(renameButton());

    await waitFor(() => expect(resolved).toHaveBeenCalledWith("Spaced out"));
  });

  it("cancels when the name was left alone", async () => {
    const user = await openDialog();

    await user.click(renameButton());

    await waitFor(() =>
      expect(rejected).toHaveBeenCalledWith(expect.any(DialogCancelledError)),
    );
    expect(resolved).not.toHaveBeenCalled();
  });

  it("cancels when Cancel is pressed", async () => {
    const user = await openDialog();

    await user.clear(nameField());
    await user.type(nameField(), "Churn model v2");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(rejected).toHaveBeenCalledWith(expect.any(DialogCancelledError)),
    );
    expect(resolved).not.toHaveBeenCalled();
  });

  it("refuses an empty name", async () => {
    const user = await openDialog();

    await user.clear(nameField());
    await user.click(renameButton());

    expect(screen.getByText("Name cannot be empty")).toBeInTheDocument();
    expect(resolved).not.toHaveBeenCalled();
    expect(rejected).not.toHaveBeenCalled();
  });

  it("refuses a name of nothing but spaces", async () => {
    const user = await openDialog();

    await user.clear(nameField());
    await user.type(nameField(), "   ");
    await user.click(renameButton());

    expect(resolved).not.toHaveBeenCalled();
    expect(rejected).not.toHaveBeenCalled();
  });

  /**
   * The complaint used to appear on blur, which grew the dialog underneath a
   * pointer already on its way to Cancel and swallowed the click. Leaving the
   * field has to say nothing at all.
   */
  it("stays quiet about an empty name until Rename is pressed", async () => {
    const user = await openDialog();

    await user.clear(nameField());
    await user.tab();

    expect(screen.queryByText("Name cannot be empty")).toBeNull();
  });

  it("reports that it was shown", async () => {
    await openDialog();

    expect(track).toHaveBeenCalledWith(
      "projects.rename_project_dialog_impression",
    );
  });
});
