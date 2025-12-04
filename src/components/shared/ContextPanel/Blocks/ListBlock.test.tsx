import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { AttributeProps } from "./Attribute";
import { ListBlock } from "./ListBlock";

describe("<ListBlock />", () => {
  test("renders without title", () => {
    const items: AttributeProps[] = [{ label: "Item 1", value: "Value 1" }];

    render(<ListBlock items={items} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Item 1:")).toBeInTheDocument();
    expect(screen.getByText("Value 1")).toBeInTheDocument();
  });

  test("renders with title", () => {
    const items: AttributeProps[] = [{ label: "Item 1", value: "Value 1" }];

    render(<ListBlock title="My List" items={items} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "My List" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Item 1:")).toBeInTheDocument();
  });

  test("renders with custom className", () => {
    const items: AttributeProps[] = [{ label: "Item 1", value: "Value 1" }];

    const { container } = render(
      <ListBlock items={items} className="custom-class" />,
    );

    const blockStack = container.querySelector(".custom-class");
    expect(blockStack).toBeInTheDocument();
  });

  test("renders empty items array without error", () => {
    const { container } = render(<ListBlock items={[]} />);

    expect(container.querySelector("li")).not.toBeInTheDocument();
  });

  describe("item rendering", () => {
    test("renders single item", () => {
      const items: AttributeProps[] = [{ label: "Key", value: "Value" }];

      render(<ListBlock items={items} />);

      expect(screen.getByText("Key:")).toBeInTheDocument();
      expect(screen.getByText("Value")).toBeInTheDocument();
    });

    test("renders multiple items", () => {
      const items: AttributeProps[] = [
        { label: "Item 1", value: "Value 1" },
        { label: "Item 2", value: "Value 2" },
        { label: "Item 3", value: "Value 3" },
      ];

      render(<ListBlock items={items} />);

      expect(screen.getByText("Item 1:")).toBeInTheDocument();
      expect(screen.getByText("Value 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2:")).toBeInTheDocument();
      expect(screen.getByText("Value 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3:")).toBeInTheDocument();
      expect(screen.getByText("Value 3")).toBeInTheDocument();
    });

    test("skips items with no value", () => {
      const items: AttributeProps[] = [
        { label: "Item 1", value: "Value 1" },
        { label: "Item 2", value: "" },
        { label: "Item 3", value: "Value 3" },
      ];

      render(<ListBlock items={items} />);

      expect(screen.getByText("Item 1:")).toBeInTheDocument();
      expect(screen.queryByText("Item 2:")).not.toBeInTheDocument();
      expect(screen.getByText("Item 3:")).toBeInTheDocument();
    });

    test("skips items with undefined value", () => {
      const items: AttributeProps[] = [
        { label: "Item 1", value: "Value 1" },
        { label: "Item 2", value: undefined },
        { label: "Item 3", value: "Value 3" },
      ];

      render(<ListBlock items={items} />);

      expect(screen.getByText("Item 1:")).toBeInTheDocument();
      expect(screen.queryByText("Item 2:")).not.toBeInTheDocument();
      expect(screen.getByText("Item 3:")).toBeInTheDocument();
    });
  });

  describe("marker types", () => {
    test("renders as unordered list with bullet marker by default", () => {
      const items: AttributeProps[] = [{ label: "Item 1", value: "Value 1" }];

      const { container } = render(<ListBlock items={items} />);

      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass("list-disc");
      expect(list).toHaveClass("pl-5");
    });

    test("renders as unordered list with bullet marker", () => {
      const items: AttributeProps[] = [{ label: "Item 1", value: "Value 1" }];

      const { container } = render(<ListBlock items={items} marker="bullet" />);

      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass("list-disc");
      expect(list).toHaveClass("pl-5");
    });

    test("renders as ordered list with number marker", () => {
      const items: AttributeProps[] = [{ label: "Item 1", value: "Value 1" }];

      const { container } = render(<ListBlock items={items} marker="number" />);

      const list = container.querySelector("ol");
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass("list-decimal");
      expect(list).toHaveClass("pl-5");
    });

    test("renders as unordered list with no marker", () => {
      const items: AttributeProps[] = [{ label: "Item 1", value: "Value 1" }];

      const { container } = render(<ListBlock items={items} marker="none" />);

      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass("list-none");
      expect(list).not.toHaveClass("pl-5");
    });
  });

  describe("list items", () => {
    test("each item is wrapped in li element", () => {
      const items: AttributeProps[] = [
        { label: "Item 1", value: "Value 1" },
        { label: "Item 2", value: "Value 2" },
      ];

      const { container } = render(<ListBlock items={items} />);

      const listItems = container.querySelectorAll("li");
      expect(listItems).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    test("renders items with only some having values", () => {
      const items: AttributeProps[] = [
        { label: "Item 1", value: "Value 1" },
        { label: "Item 2", value: "" },
        { label: "Item 3", value: undefined },
        { label: "Item 4", value: "Value 4" },
      ];

      const { container } = render(<ListBlock items={items} />);

      const listItems = container.querySelectorAll("li");
      // Only 2 items should render (Item 1 and Item 4)
      expect(listItems).toHaveLength(2);
      expect(screen.getByText("Item 1:")).toBeInTheDocument();
      expect(screen.getByText("Item 4:")).toBeInTheDocument();
    });

    test("handles all items having no value", () => {
      const items: AttributeProps[] = [
        { label: "Item 1", value: "" },
        { label: "Item 2", value: undefined },
      ];

      const { container } = render(<ListBlock items={items} />);

      const listItems = container.querySelectorAll("li");
      expect(listItems).toHaveLength(0);
    });

    test("renders title even when no items have values", () => {
      const items: AttributeProps[] = [{ label: "Item 1", value: "" }];

      render(<ListBlock title="Empty List" items={items} />);

      expect(
        screen.getByRole("heading", { name: "Empty List" }),
      ).toBeInTheDocument();
    });
  });
});
