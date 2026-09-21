import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import CodeViewer from "./CodeViewer";

vi.mock("@monaco-editor/react", () => ({
  default: ({ defaultValue }: { defaultValue: string }) => (
    <pre data-testid="monaco-mock">{defaultValue}</pre>
  ),
}));

describe("<CodeViewer />", () => {
  test("renders static header actions alongside the fullscreen toggle", () => {
    render(
      <CodeViewer code="hello" headerActions={<button>Pop out</button>} />,
    );

    expect(screen.getByRole("button", { name: "Pop out" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "View fullscreen" }),
    ).toBeVisible();
  });

  test("gives function header actions a way out of fullscreen", async () => {
    const user = userEvent.setup();
    const onPopOut = vi.fn();

    render(
      <CodeViewer
        code="hello"
        headerActions={({ exitFullscreen }) => (
          <button
            onClick={() => {
              exitFullscreen();
              onPopOut();
            }}
          >
            Pop out
          </button>
        )}
      />,
    );

    await user.click(screen.getByRole("button", { name: "View fullscreen" }));
    expect(
      screen.getByRole("button", { name: "Exit fullscreen" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Pop out" }));

    expect(onPopOut).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "View fullscreen" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Exit fullscreen" }),
    ).not.toBeInTheDocument();
  });

  test("calls onClose when a header action leaves fullscreen", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <CodeViewer
        code="hello"
        onClose={onClose}
        headerActions={({ exitFullscreen }) => (
          <button onClick={exitFullscreen}>Pop out</button>
        )}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pop out" }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "View fullscreen" }));
    await user.click(screen.getByRole("button", { name: "Pop out" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
