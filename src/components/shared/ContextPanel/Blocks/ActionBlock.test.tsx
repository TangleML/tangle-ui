import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { Action } from "./ActionBlock";
import { ActionBlock } from "./ActionBlock";

describe("<ActionBlock />", () => {
  test("renders without title", () => {
    const actions: Action[] = [
      { label: "Test Action", icon: "Copy", onClick: vi.fn() },
    ];

    render(<ActionBlock actions={actions} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByTestId("action-Test Action")).toBeInTheDocument();
  });

  test("renders with title", () => {
    const actions: Action[] = [
      { label: "Test Action", icon: "Copy", onClick: vi.fn() },
    ];

    render(<ActionBlock title="Actions" actions={actions} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Actions" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("action-Test Action")).toBeInTheDocument();
  });

  test("renders with custom className", () => {
    const actions: Action[] = [
      { label: "Test Action", icon: "Copy", onClick: vi.fn() },
    ];

    const { container } = render(
      <ActionBlock actions={actions} className="custom-class" />,
    );

    const blockStack = container.querySelector(".custom-class");
    expect(blockStack).toBeInTheDocument();
  });

  test("renders empty actions array without error", () => {
    const { container } = render(<ActionBlock actions={[]} />);

    expect(
      container.querySelector('[data-testid^="action-"]'),
    ).not.toBeInTheDocument();
  });

  describe("action rendering", () => {
    test("renders action button with icon", () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        { label: "Copy Action", icon: "Copy", onClick },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Copy Action");
      expect(button).toBeInTheDocument();

      const icon = button.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("lucide-copy");
    });

    test("renders action button with custom content", () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        { label: "Custom Action", content: <span>Custom</span>, onClick },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Custom Action");
      expect(button).toBeInTheDocument();
      expect(within(button).getByText("Custom")).toBeInTheDocument();
    });

    test("renders multiple actions", () => {
      const actions: Action[] = [
        { label: "Action 1", icon: "Copy", onClick: vi.fn() },
        { label: "Action 2", icon: "Download", onClick: vi.fn() },
        { label: "Action 3", icon: "Trash", onClick: vi.fn() },
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("action-Action 1")).toBeInTheDocument();
      expect(screen.getByTestId("action-Action 2")).toBeInTheDocument();
      expect(screen.getByTestId("action-Action 3")).toBeInTheDocument();
    });
  });

  describe("action variants", () => {
    test("renders destructive action with destructive variant", () => {
      const actions: Action[] = [
        { label: "Delete", icon: "Trash", destructive: true, onClick: vi.fn() },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Delete");
      expect(button).toHaveClass("bg-destructive");
      expect(button).toHaveClass("text-white");
    });

    test("renders non-destructive action with outline variant", () => {
      const actions: Action[] = [
        { label: "Copy", icon: "Copy", onClick: vi.fn() },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Copy");
      expect(button).toHaveClass("border");
      expect(button).toHaveClass("bg-background");
    });

    test("applies custom className to action button", () => {
      const actions: Action[] = [
        {
          label: "Styled Action",
          icon: "Copy",
          onClick: vi.fn(),
          className: "custom-button",
        },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Styled Action");
      expect(button).toHaveClass("custom-button");
    });
  });

  describe("action states", () => {
    test("renders disabled action", () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        { label: "Disabled Action", icon: "Copy", disabled: true, onClick },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Disabled Action");
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    test("renders enabled action", () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        { label: "Enabled Action", icon: "Copy", disabled: false, onClick },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Enabled Action");
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    test("does not render hidden action", () => {
      const actions: Action[] = [
        { label: "Visible Action", icon: "Copy", onClick: vi.fn() },
        {
          label: "Hidden Action",
          icon: "Trash",
          hidden: true,
          onClick: vi.fn(),
        },
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("action-Visible Action")).toBeInTheDocument();
      expect(
        screen.queryByTestId("action-Hidden Action"),
      ).not.toBeInTheDocument();
    });
  });

  describe("onClick behavior", () => {
    test("calls onClick when action is clicked", () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        { label: "Click Action", icon: "Copy", onClick },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Click Action");
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    test("calls onClick multiple times when clicked multiple times", () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        { label: "Multi Click", icon: "Copy", onClick },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Multi Click");
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(3);
    });
  });

  describe("confirmation dialog", () => {
    test("opens confirmation dialog when action has confirmation", () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        {
          label: "Delete",
          icon: "Trash",
          confirmation: "Are you sure you want to delete?",
          onClick,
        },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Delete");
      fireEvent.click(button);

      // Dialog should appear
      expect(
        screen.getByText("Are you sure you want to delete?"),
      ).toBeInTheDocument();
      expect(onClick).not.toHaveBeenCalled();
    });

    test("executes onClick when confirmation is accepted", async () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        {
          label: "Delete",
          icon: "Trash",
          confirmation: "Confirm deletion?",
          onClick,
        },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Delete");
      fireEvent.click(button);

      // Confirm in dialog
      const confirmButton = screen.getByRole("button", { name: "Continue" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onClick).toHaveBeenCalledTimes(1);
      });
    });

    test("does not execute onClick when confirmation is cancelled", async () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        {
          label: "Delete",
          icon: "Trash",
          confirmation: "Confirm deletion?",
          onClick,
        },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Delete");
      fireEvent.click(button);

      // Cancel in dialog
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(onClick).not.toHaveBeenCalled();
      });
    });

    test("closes dialog after confirmation", async () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        {
          label: "Delete",
          icon: "Trash",
          confirmation: "Confirm deletion?",
          onClick,
        },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Delete");
      fireEvent.click(button);

      expect(screen.getByText("Confirm deletion?")).toBeInTheDocument();

      const confirmButton = screen.getByRole("button", { name: "Continue" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText("Confirm deletion?")).not.toBeInTheDocument();
      });
    });

    test("closes dialog after cancellation", async () => {
      const onClick = vi.fn();
      const actions: Action[] = [
        {
          label: "Delete",
          icon: "Trash",
          confirmation: "Confirm deletion?",
          onClick,
        },
      ];

      render(<ActionBlock actions={actions} />);

      const deleteButton = screen.getByTestId("action-Delete");
      fireEvent.click(deleteButton);

      expect(screen.getByText("Confirm deletion?")).toBeInTheDocument();

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText("Confirm deletion?")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("action-Delete")).toBeInTheDocument();
    });

    test("executes onClick directly when no confirmation is provided", () => {
      const onClick = vi.fn();
      const actions: Action[] = [{ label: "Copy", icon: "Copy", onClick }];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Copy");
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    test("shows action label as dialog title", () => {
      const actions: Action[] = [
        {
          label: "Delete Item",
          icon: "Trash",
          confirmation: "Confirm?",
          onClick: vi.fn(),
        },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Delete Item");
      fireEvent.click(button);

      expect(screen.getByText("Delete Item")).toBeInTheDocument();
      expect(screen.getByText("Confirm?")).toBeInTheDocument();
    });
  });

  describe("tooltip", () => {
    test("action has tooltip with label", () => {
      const actions: Action[] = [
        { label: "Copy to Clipboard", icon: "Copy", onClick: vi.fn() },
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("action-Copy to Clipboard");
      expect(button).toBeInTheDocument();
    });
  });
});
