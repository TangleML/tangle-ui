import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import PipelineNameDialog from "./PipelineNameDialog";

it.each([
  ["Existing pipeline", true],
  ["  ", false],
] as const)("requires a nonempty name: %s", async (initialName, canSubmit) => {
  const onSubmit = vi.fn();
  render(
    <PipelineNameDialog
      open
      title="Save Pipeline As"
      initialName={initialName}
      submitButtonText="Save"
      onSubmit={onSubmit}
    />,
  );
  const button = screen.getByRole("button", { name: "Save" });
  if (canSubmit) {
    await userEvent.setup().click(button);
    expect(onSubmit).toHaveBeenCalledWith(initialName);
  } else {
    expect(button).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  }
});
