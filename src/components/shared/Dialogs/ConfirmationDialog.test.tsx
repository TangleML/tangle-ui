import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import ConfirmationDialog from "./ConfirmationDialog";

const key = "skip-save-as-remote-pipeline-confirmation";

function dialog(onConfirm = vi.fn()) {
  return (
    <ConfirmationDialog
      trigger={<button>Save remotely</button>}
      title="Save remotely?"
      onConfirm={onConfirm}
      dismissForeverKey={key}
    />
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("remembers the confirmed choice across rows and remounts", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const nextRowConfirm = vi.fn();
  const { unmount } = render(
    <>
      {dialog(onConfirm)}
      {dialog(nextRowConfirm)}
    </>,
  );
  await user.click(screen.getAllByRole("button", { name: "Save remotely" })[0]);
  await user.click(
    screen.getByRole("checkbox", { name: "Don't show this again" }),
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(key)).toBe("true");
  await user.click(screen.getAllByRole("button", { name: "Save remotely" })[1]);
  expect(nextRowConfirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  unmount();

  render(dialog(onConfirm));
  await user.click(screen.getByRole("button", { name: "Save remotely" }));
  expect(onConfirm).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

it("does not remember the checkbox when canceled", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(dialog(onConfirm));
  await user.click(screen.getByRole("button", { name: "Save remotely" }));
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
  await user.click(screen.getByRole("button", { name: "Save remotely" }));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});

it("keeps prompting when confirmed without the checkbox", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(dialog(onConfirm));
  await user.click(screen.getByRole("button", { name: "Save remotely" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Save remotely" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});

it("leaves other confirmations unchanged", async () => {
  const user = userEvent.setup();
  localStorage.setItem(key, "true");
  render(
    <ConfirmationDialog
      trigger={<button>Delete</button>}
      onConfirm={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

it.each(["getItem", "setItem"] as const)(
  "still confirms when storage %s fails",
  async (method) => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    render(dialog(onConfirm));
    await user.click(screen.getByRole("button", { name: "Save remotely" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  },
);
