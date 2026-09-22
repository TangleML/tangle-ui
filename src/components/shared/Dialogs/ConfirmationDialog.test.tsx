import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConfirmationDialog from "./ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("prevents cancellation and repeated confirmation while pending", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        isOpen
        pending
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Working..." });
    expect(cancel).toBeDisabled();
    expect(confirm).toBeDisabled();

    fireEvent.click(cancel);
    fireEvent.click(confirm);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
