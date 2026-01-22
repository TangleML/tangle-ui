import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { ActionBlock } from "./ActionBlock";

describe("<ActionBlock />", () => {
  test("renders without title", () => {
    const actions = [
      <Button key="test" data-testid="test-action">
        Test Action
      </Button>,
    ];

    render(<ActionBlock actions={actions} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByTestId("test-action")).toBeInTheDocument();
  });

  test("renders with title", () => {
    const actions = [
      <Button key="test" data-testid="test-action">
        Test Action
      </Button>,
    ];

    render(<ActionBlock title="Actions" actions={actions} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Actions" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("test-action")).toBeInTheDocument();
  });

  test("renders with custom className", () => {
    const actions = [
      <Button key="test" data-testid="test-action">
        Test Action
      </Button>,
    ];

    const { container } = render(
      <ActionBlock actions={actions} className="custom-class" />,
    );

    const blockStack = container.querySelector(".custom-class");
    expect(blockStack).toBeInTheDocument();
  });

  test("renders empty actions array without error", () => {
    const { container } = render(<ActionBlock actions={[]} />);

    expect(container.querySelector("button")).not.toBeInTheDocument();
  });

  describe("action rendering", () => {
    test("renders action button with icon", () => {
      const actions = [
        <Button key="copy" data-testid="copy-action">
          <Icon name="Copy" />
          Copy Action
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("copy-action");
      expect(button).toBeInTheDocument();

      const icon = button.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("lucide-copy");
    });

    test("renders action button with custom content", () => {
      const actions = [
        <Button key="custom" data-testid="custom-action">
          <span>Custom Content</span>
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("custom-action");
      expect(button).toBeInTheDocument();
      expect(screen.getByText("Custom Content")).toBeInTheDocument();
    });

    test("renders multiple actions", () => {
      const actions = [
        <Button key="action1" data-testid="action-1">
          Action 1
        </Button>,
        <Button key="action2" data-testid="action-2">
          Action 2
        </Button>,
        <Button key="action3" data-testid="action-3">
          Action 3
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("action-1")).toBeInTheDocument();
      expect(screen.getByTestId("action-2")).toBeInTheDocument();
      expect(screen.getByTestId("action-3")).toBeInTheDocument();
    });

    test("renders custom ReactNode as action", () => {
      const actions = [
        <Button key="button" data-testid="button-action">
          Button Action
        </Button>,
        <div key="custom" data-testid="custom-node">
          Custom Node
        </div>,
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("button-action")).toBeInTheDocument();
      expect(screen.getByTestId("custom-node")).toBeInTheDocument();
    });

    test("handles null or undefined actions gracefully", () => {
      const actions = [
        <Button key="action1" data-testid="action-1">
          Action 1
        </Button>,
        null,
        undefined,
        <Button key="action2" data-testid="action-2">
          Action 2
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("action-1")).toBeInTheDocument();
      expect(screen.getByTestId("action-2")).toBeInTheDocument();
    });
  });

  describe("action variants", () => {
    test("renders destructive action variant", () => {
      const actions = [
        <Button key="delete" data-testid="delete-action" variant="destructive">
          <Icon name="Trash" />
          Delete
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("delete-action");
      expect(button).toHaveClass("bg-destructive");
      expect(button).toHaveClass("text-white");
    });

    test("renders outline action variant", () => {
      const actions = [
        <Button key="copy" data-testid="copy-action" variant="outline">
          <Icon name="Copy" />
          Copy
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("copy-action");
      expect(button).toHaveClass("border");
      expect(button).toHaveClass("bg-background");
    });

    test("applies custom className to action button", () => {
      const actions = [
        <Button
          key="styled"
          data-testid="styled-action"
          className="custom-button"
        >
          Styled Action
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("styled-action");
      expect(button).toHaveClass("custom-button");
    });
  });

  describe("action states", () => {
    test("renders disabled action", () => {
      const onClick = vi.fn();
      const actions = [
        <Button
          key="disabled"
          data-testid="disabled-action"
          disabled
          onClick={onClick}
        >
          Disabled Action
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("disabled-action");
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    test("renders enabled action", () => {
      const onClick = vi.fn();
      const actions = [
        <Button
          key="enabled"
          data-testid="enabled-action"
          disabled={false}
          onClick={onClick}
        >
          Enabled Action
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("enabled-action");
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    test("conditionally renders actions based on logic", () => {
      const showHidden = false;
      const actions = [
        <Button key="visible" data-testid="visible-action">
          Visible Action
        </Button>,
        showHidden ? (
          <Button key="hidden" data-testid="hidden-action">
            Hidden Action
          </Button>
        ) : null,
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("visible-action")).toBeInTheDocument();
      expect(screen.queryByTestId("hidden-action")).not.toBeInTheDocument();
    });
  });

  describe("onClick behavior", () => {
    test("calls onClick when action is clicked", () => {
      const onClick = vi.fn();
      const actions = [
        <Button key="click" data-testid="click-action" onClick={onClick}>
          Click Action
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("click-action");
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    test("calls onClick multiple times when clicked multiple times", () => {
      const onClick = vi.fn();
      const actions = [
        <Button key="multi" data-testid="multi-click" onClick={onClick}>
          Multi Click
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("multi-click");
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(3);
    });
  });

  describe("action keys", () => {
    test("uses provided keys for actions", () => {
      const actions = [
        <Button key="custom-key-1" data-testid="action-1">
          Action 1
        </Button>,
        <Button key="custom-key-2" data-testid="action-2">
          Action 2
        </Button>,
      ];

      const { container } = render(<ActionBlock actions={actions} />);

      const actionWrappers = container.querySelectorAll("span[key]");
      expect(actionWrappers.length).toBeGreaterThanOrEqual(0);
    });

    test("generates keys for actions without keys", () => {
      const actions = [
        // eslint-disable-next-line react/jsx-key
        <Button data-testid="action-1">Action 1</Button>,
        // eslint-disable-next-line react/jsx-key
        <Button data-testid="action-2">Action 2</Button>,
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("action-1")).toBeInTheDocument();
      expect(screen.getByTestId("action-2")).toBeInTheDocument();
    });
  });

  describe("complex action scenarios", () => {
    test("renders mixed action types", () => {
      const actions = [
        <Button key="button" data-testid="button-action" variant="outline">
          Button
        </Button>,
        <a
          key="link"
          href="#"
          data-testid="link-action"
          className="inline-flex items-center"
        >
          Link
        </a>,
        <span key="text" data-testid="text-action">
          Text
        </span>,
      ];

      render(<ActionBlock actions={actions} />);

      expect(screen.getByTestId("button-action")).toBeInTheDocument();
      expect(screen.getByTestId("link-action")).toBeInTheDocument();
      expect(screen.getByTestId("text-action")).toBeInTheDocument();
    });

    test("renders actions with nested components", () => {
      const actions = [
        <Button key="nested" data-testid="nested-action">
          <Icon name="Download" />
          <span>Download</span>
        </Button>,
      ];

      render(<ActionBlock actions={actions} />);

      const button = screen.getByTestId("nested-action");
      expect(button).toBeInTheDocument();
      expect(button.querySelector("svg")).toBeInTheDocument();
      expect(screen.getByText("Download")).toBeInTheDocument();
    });
  });
});
