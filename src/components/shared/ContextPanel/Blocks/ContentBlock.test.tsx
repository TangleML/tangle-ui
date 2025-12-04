import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ContentBlock } from "./ContentBlock";

describe("<ContentBlock />", () => {
  test("renders with title and children", () => {
    render(
      <ContentBlock title="Test Title">
        <div>Test Content</div>
      </ContentBlock>,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("renders without title", () => {
    render(
      <ContentBlock>
        <div>Test Content</div>
      </ContentBlock>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("returns null when children is not provided", () => {
    const { container } = render(<ContentBlock title="No Content" />);

    expect(container.firstChild).toBeNull();
  });

  test("applies custom className to container", () => {
    const { container } = render(
      <ContentBlock title="Test" className="custom-class">
        <div>Content</div>
      </ContentBlock>,
    );

    const blockStack = container.querySelector(".custom-class");
    expect(blockStack).toBeInTheDocument();
  });

  test("renders title as Heading component with level 3", () => {
    render(
      <ContentBlock title="My Heading">
        <div>Content</div>
      </ContentBlock>,
    );

    const heading = screen.getByRole("heading", {
      level: 3,
      name: "My Heading",
    });
    expect(heading).toBeInTheDocument();
  });

  test("renders multiple children", () => {
    render(
      <ContentBlock title="Multiple Children">
        <div>First Child</div>
        <div>Second Child</div>
        <span>Third Child</span>
      </ContentBlock>,
    );

    expect(screen.getByText("First Child")).toBeInTheDocument();
    expect(screen.getByText("Second Child")).toBeInTheDocument();
    expect(screen.getByText("Third Child")).toBeInTheDocument();
  });

  test("renders with complex nested content", () => {
    render(
      <ContentBlock title="Complex Content">
        <div>
          <p>Paragraph 1</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      </ContentBlock>,
    );

    expect(screen.getByText("Paragraph 1")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  test("handles undefined children gracefully", () => {
    const { container } = render(
      <ContentBlock title="Null Children">{undefined}</ContentBlock>,
    );

    // Should return null since children are falsy
    expect(container.firstChild).toBeNull();
  });

  test("renders with ReactNode as children", () => {
    const CustomComponent = () => <div>Custom Component Content</div>;

    render(
      <ContentBlock title="React Component">
        <CustomComponent />
      </ContentBlock>,
    );

    expect(screen.getByText("Custom Component Content")).toBeInTheDocument();
  });

  test("renders with both title and className", () => {
    const { container } = render(
      <ContentBlock title="Styled Block" className="my-custom-style">
        <div>Styled Content</div>
      </ContentBlock>,
    );

    expect(screen.getByText("Styled Block")).toBeInTheDocument();
    expect(container.querySelector(".my-custom-style")).toBeInTheDocument();
  });

  describe("non-collapsible mode", () => {
    test("does not show toggle button when collapsible is false", () => {
      render(
        <ContentBlock title="Not Collapsible" collapsible={false}>
          <div>Content</div>
        </ContentBlock>,
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    test("does not show toggle button when collapsible is not provided", () => {
      render(
        <ContentBlock title="Default">
          <div>Content</div>
        </ContentBlock>,
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("collapsible mode", () => {
    test("shows toggle button when collapsible is true", () => {
      render(
        <ContentBlock title="Collapsible" collapsible={true}>
          <div>Content</div>
        </ContentBlock>,
      );

      const button = screen.getByRole("button", { name: /toggle/i });
      expect(button).toBeInTheDocument();
    });

    test("starts open when defaultOpen is true", () => {
      render(
        <ContentBlock title="Collapsible" collapsible={true} defaultOpen={true}>
          <div>Visible Content</div>
        </ContentBlock>,
      );

      const content = screen.getByText("Visible Content");
      expect(content).toBeVisible();
      expect(content.parentElement).toHaveAttribute("data-state", "open");
    });
  });
});
