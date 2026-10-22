import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import PipelineNameDialog from "./PipelineNameDialog";

const local = vi.hoisted(() => ({ loading: false }));
vi.mock("@/hooks/useLoadUserPipelines", () => ({
  default: () => ({
    userPipelines: new Map([["Existing pipeline", {}]]),
    isLoadingUserPipelines: local.loading,
    refetch: vi.fn(),
  }),
}));

it.each([
  [false, "Existing pipeline", true, true],
  [true, "Existing pipeline", false, false],
  [false, "  ", false, false],
] as const)(
  "validates names independently of local storage (validateLocalName: %s, name: %s)",
  async (validateLocalName, initialName, loading, canSubmit) => {
    local.loading = loading;
    const onSubmit = vi.fn();
    render(
      <PipelineNameDialog
        open
        title="Save Pipeline As"
        initialName={initialName}
        submitButtonText="Save"
        validateLocalName={validateLocalName}
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
  },
);
