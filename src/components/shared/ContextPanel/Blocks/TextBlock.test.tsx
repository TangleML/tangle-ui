import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TextBlock } from "./TextBlock";

describe("<TextBlock />", () => {
  test("renders with text only", () => {
    render(<TextBlock text="Test Text" />);

    expect(screen.getByText("Test Text")).toBeInTheDocument();
  });

  test("renders with title and text", () => {
    render(<TextBlock title="Test Title" text="Test Text" />);

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Text")).toBeInTheDocument();
  });

  test("renders without title", () => {
    render(<TextBlock text="Test Text" />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Test Text")).toBeInTheDocument();
  });

  test("returns null when text is not provided", () => {
    const { container } = render(<TextBlock title="No Text" />);

    expect(container.firstChild).toBeNull();
  });

  test("returns null when text is empty string", () => {
    const { container } = render(<TextBlock text="" />);

    expect(container.firstChild).toBeNull();
  });

  test("applies custom className to container", () => {
    const { container } = render(
      <TextBlock text="Test" className="custom-class" />,
    );

    const blockStack = container.querySelector(".custom-class");
    expect(blockStack).toBeInTheDocument();
  });

  test("renders title as Heading component with level 3", () => {
    render(<TextBlock title="My Heading" text="Content" />);

    const heading = screen.getByRole("heading", {
      level: 3,
      name: "My Heading",
    });
    expect(heading).toBeInTheDocument();
  });

  describe("text styling", () => {
    test("renders with monospace font when mono is true", () => {
      render(<TextBlock text="Mono Text" mono={true} />);

      const paragraph = screen.getByText("Mono Text");
      expect(paragraph).toHaveClass("!font-mono");
    });

    test("renders with default font when mono is false", () => {
      render(<TextBlock text="Normal Text" mono={false} />);

      const paragraph = screen.getByText("Normal Text");
      expect(paragraph).not.toHaveClass("font-mono");
    });

    test("renders with default font when mono is not provided", () => {
      render(<TextBlock text="Normal Text" />);

      const paragraph = screen.getByText("Normal Text");
      expect(paragraph).not.toHaveClass("font-mono");
    });

    test("truncates text when wrap is false", () => {
      render(<TextBlock text="Long Text" wrap={false} />);

      const paragraph = screen.getByText("Long Text");
      expect(paragraph).toHaveClass("truncate");
      expect(paragraph).not.toHaveClass("wrap-break-words");
    });

    test("truncates text by default when wrap is not provided", () => {
      render(<TextBlock text="Long Text" />);

      const paragraph = screen.getByText("Long Text");
      expect(paragraph).toHaveClass("truncate");
      expect(paragraph).not.toHaveClass("wrap-break-words");
    });

    test("wraps text when wrap is true", () => {
      render(<TextBlock text="Long Text" wrap={true} />);

      const paragraph = screen.getByText("Long Text");
      expect(paragraph).toHaveClass("wrap-break-words");
      expect(paragraph).not.toHaveClass("truncate");
    });

    test("applies text-xs and text-muted-foreground classes", () => {
      render(<TextBlock text="Styled Text" />);

      const paragraph = screen.getByText("Styled Text");
      expect(paragraph).toHaveClass("text-xs");
      expect(paragraph).toHaveClass("text-muted-foreground");
    });
  });

  describe("copyable functionality", () => {
    test("renders CopyText component when copyable is true", () => {
      render(<TextBlock text="Copyable Text" copyable={true} />);

      // CopyText should be present
      const copyText = screen.getByText("Copyable Text");
      expect(copyText).toBeInTheDocument();
    });

    test("renders Paragraph component when copyable is false", () => {
      render(<TextBlock text="Non-Copyable Text" copyable={false} />);

      const paragraph = screen.getByText("Non-Copyable Text");
      expect(paragraph.tagName).toBe("P");
    });

    test("renders Paragraph component when copyable is not provided", () => {
      render(<TextBlock text="Non-Copyable Text" />);

      const paragraph = screen.getByText("Non-Copyable Text");
      expect(paragraph.tagName).toBe("P");
    });
  });

  describe("non-collapsible mode", () => {
    test("does not show toggle button when collapsible is false", () => {
      render(
        <TextBlock
          title="Not Collapsible"
          text="Content"
          collapsible={false}
        />,
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    test("does not show toggle button when collapsible is not provided", () => {
      render(<TextBlock title="Default" text="Content" />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("collapsible mode", () => {
    test("shows toggle button when collapsible is true", () => {
      render(
        <TextBlock title="Collapsible" text="Content" collapsible={true} />,
      );

      const button = screen.getByRole("button", { name: /toggle/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("combined props", () => {
    test("renders with mono, wrap, and copyable together", () => {
      render(
        <TextBlock
          text="Combined Text"
          mono={true}
          wrap={true}
          copyable={true}
        />,
      );

      const text = screen.getByText("Combined Text");
      expect(text).toBeInTheDocument();
    });
  });
});
