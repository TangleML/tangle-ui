import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnnotationFilterInput } from "./AnnotationFilterInput";

describe("AnnotationFilterInput", () => {
  describe("empty state", () => {
    it("should show add filter button when no filters", () => {
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      expect(screen.getByText("Annotations:")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add filter/i }),
      ).toBeInTheDocument();
    });

    it("should not show any badges when no filters", () => {
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      expect(
        screen.queryByRole("button", { name: /remove/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("expanding input form", () => {
    it("should show input fields when add filter is clicked", async () => {
      const user = userEvent.setup();
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));

      expect(screen.getByPlaceholderText("Key")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Value (optional)"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    });

    it("should focus key input when expanded", async () => {
      const user = userEvent.setup();
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));

      expect(screen.getByPlaceholderText("Key")).toHaveFocus();
    });

    it("should collapse when cancel button is clicked", async () => {
      const user = userEvent.setup();
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));
      expect(screen.getByPlaceholderText("Key")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByPlaceholderText("Key")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add filter/i }),
      ).toBeInTheDocument();
    });
  });

  describe("adding filters", () => {
    it("should add filter with key only", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AnnotationFilterInput filters={[]} onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));
      await user.type(screen.getByPlaceholderText("Key"), "env");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(onChange).toHaveBeenCalledWith([{ key: "env" }]);
    });

    it("should add filter with key and value", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AnnotationFilterInput filters={[]} onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));
      await user.type(screen.getByPlaceholderText("Key"), "team");
      await user.type(screen.getByPlaceholderText("Value (optional)"), "ml");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(onChange).toHaveBeenCalledWith([{ key: "team", value: "ml" }]);
    });

    it("should trim whitespace from key and value", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AnnotationFilterInput filters={[]} onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));
      await user.type(screen.getByPlaceholderText("Key"), "  team  ");
      await user.type(
        screen.getByPlaceholderText("Value (optional)"),
        "  ml  ",
      );
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(onChange).toHaveBeenCalledWith([{ key: "team", value: "ml" }]);
    });

    it("should disable add button when key is empty", async () => {
      const user = userEvent.setup();
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));

      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });

    it("should clear inputs after adding", async () => {
      const user = userEvent.setup();
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));
      await user.type(screen.getByPlaceholderText("Key"), "team");
      await user.type(screen.getByPlaceholderText("Value (optional)"), "ml");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.queryByPlaceholderText("Key")).not.toBeInTheDocument();
    });

    it("should add filter on Enter key press", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<AnnotationFilterInput filters={[]} onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));
      await user.type(screen.getByPlaceholderText("Key"), "team");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith([{ key: "team" }]);
    });

    it("should collapse on Escape key press", async () => {
      const user = userEvent.setup();
      render(<AnnotationFilterInput filters={[]} onChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /add filter/i }));
      await user.keyboard("{Escape}");

      expect(screen.queryByPlaceholderText("Key")).not.toBeInTheDocument();
    });
  });

  describe("displaying filters", () => {
    it("should display filter with key only", () => {
      render(
        <AnnotationFilterInput filters={[{ key: "env" }]} onChange={vi.fn()} />,
      );

      expect(screen.getByText("env")).toBeInTheDocument();
    });

    it("should display filter with key and value", () => {
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText("team: ml")).toBeInTheDocument();
    });

    it("should display multiple filters", () => {
      render(
        <AnnotationFilterInput
          filters={[
            { key: "team", value: "ml" },
            { key: "env", value: "prod" },
            { key: "priority" },
          ]}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText("team: ml")).toBeInTheDocument();
      expect(screen.getByText("env: prod")).toBeInTheDocument();
      expect(screen.getByText("priority")).toBeInTheDocument();
    });
  });

  describe("removing filters", () => {
    it("should remove filter when remove button is clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AnnotationFilterInput
          filters={[
            { key: "team", value: "ml" },
            { key: "env", value: "prod" },
          ]}
          onChange={onChange}
        />,
      );

      const removeButton = screen.getByRole("button", {
        name: /remove team filter/i,
      });
      await user.click(removeButton);

      expect(onChange).toHaveBeenCalledWith([{ key: "env", value: "prod" }]);
    });

    it("should have accessible remove button", () => {
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: /remove team filter/i }),
      ).toBeInTheDocument();
    });
  });

  describe("editing filters", () => {
    it("should enter edit mode on double-click", async () => {
      const user = userEvent.setup();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={vi.fn()}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      expect(screen.getByDisplayValue("team")).toBeInTheDocument();
      expect(screen.getByDisplayValue("ml")).toBeInTheDocument();
    });

    it("should focus key input when entering edit mode", async () => {
      const user = userEvent.setup();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={vi.fn()}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      expect(screen.getByDisplayValue("team")).toHaveFocus();
    });

    it("should save changes on Enter", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={onChange}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      const keyInput = screen.getByDisplayValue("team");
      await user.clear(keyInput);
      await user.type(keyInput, "department");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith([
        { key: "department", value: "ml" },
      ]);
    });

    it("should cancel edit on Escape", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={onChange}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      const keyInput = screen.getByDisplayValue("team");
      await user.clear(keyInput);
      await user.type(keyInput, "different");
      await user.keyboard("{Escape}");

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText("team: ml")).toBeInTheDocument();
    });

    it("should save changes when clicking save button", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={onChange}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      const valueInput = screen.getByDisplayValue("ml");
      await user.clear(valueInput);
      await user.type(valueInput, "data");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(onChange).toHaveBeenCalledWith([{ key: "team", value: "data" }]);
    });

    it("should cancel edit when clicking cancel button", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={onChange}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      await user.click(screen.getByRole("button", { name: /cancel editing/i }));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText("team: ml")).toBeInTheDocument();
    });

    it("should remove value if cleared during edit", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={onChange}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      const valueInput = screen.getByDisplayValue("ml");
      await user.clear(valueInput);
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith([{ key: "team" }]);
    });

    it("should cancel if key is cleared during edit", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={onChange}
        />,
      );

      const badge = screen.getByText("team: ml");
      await user.dblClick(badge);

      const keyInput = screen.getByDisplayValue("team");
      await user.clear(keyInput);
      await user.keyboard("{Enter}");

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText("team: ml")).toBeInTheDocument();
    });

    it("should show tooltip hint on badge", () => {
      render(
        <AnnotationFilterInput
          filters={[{ key: "team", value: "ml" }]}
          onChange={vi.fn()}
        />,
      );

      const badge = screen.getByText("team: ml").closest("[title]");
      expect(badge).toHaveAttribute("title", "Double-click to edit");
    });
  });
});
