import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ConfirmPayload, ConfirmResult } from "@/config/preSubmitHooks";

import { ConfirmDialogBridge } from "./ConfirmDialogBridge";

const invokeConfirm = (payload: ConfirmPayload) => {
  let result!: Promise<ConfirmResult>;
  act(() => {
    result = window.__TANGLE_CONFIRM__!(payload);
  });
  return result;
};

describe("ConfirmDialogBridge", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    delete window.__TANGLE_CONFIRM__;
  });

  it("installs window.__TANGLE_CONFIRM__ on mount and removes it on unmount", () => {
    const { unmount } = render(<ConfirmDialogBridge />);
    expect(typeof window.__TANGLE_CONFIRM__).toBe("function");

    unmount();
    expect(window.__TANGLE_CONFIRM__).toBeUndefined();
  });

  it("renders a dialog with the payload content when invoked", async () => {
    render(<ConfirmDialogBridge />);

    invokeConfirm({ title: "Are you sure?", body: "This may fail." });

    expect(await screen.findByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("This may fail.")).toBeInTheDocument();
  });

  it("resolves with confirmed: true when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogBridge />);

    const result = invokeConfirm({
      title: "T",
      body: "B",
      confirmLabel: "Proceed",
    });

    await user.click(await screen.findByRole("button", { name: "Proceed" }));

    await expect(result).resolves.toEqual({
      confirmed: true,
      dismissForever: false,
    });
  });

  it("resolves with confirmed: false when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogBridge />);

    const result = invokeConfirm({
      title: "T",
      body: "B",
      cancelLabel: "Go back",
    });

    await user.click(await screen.findByRole("button", { name: "Go back" }));

    await expect(result).resolves.toEqual({
      confirmed: false,
      dismissForever: false,
    });
  });

  it("closes the dialog after resolving", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogBridge />);

    invokeConfirm({ title: "Closing", body: "B", confirmLabel: "OK" });

    await user.click(await screen.findByRole("button", { name: "OK" }));

    await waitFor(() => {
      expect(screen.queryByText("Closing")).not.toBeInTheDocument();
    });
  });

  it("writes localStorage when dismissForever is checked and confirmed", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogBridge />);

    const result = invokeConfirm({
      title: "T",
      body: "B",
      confirmLabel: "OK",
      dismissForeverKey: "dismiss-csa-warning",
    });

    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "OK" }));

    await expect(result).resolves.toEqual({
      confirmed: true,
      dismissForever: true,
    });
    expect(localStorage.getItem("dismiss-csa-warning")).toBe("true");
  });

  it("does not render the checkbox when dismissForeverKey is absent", async () => {
    render(<ConfirmDialogBridge />);

    invokeConfirm({ title: "No checkbox", body: "B" });

    await screen.findByText("No checkbox");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
