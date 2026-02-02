import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreatedByFilter } from "./CreatedByFilter";

describe("CreatedByFilter", () => {
  describe("rendering", () => {
    it("should render search input with placeholder", () => {
      render(
        <CreatedByFilter
          value={undefined}
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(
        screen.getByPlaceholderText("Search by user..."),
      ).toBeInTheDocument();
    });

    it("should not show clear button when empty", () => {
      render(
        <CreatedByFilter
          value={undefined}
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", { name: "Clear user filter" }),
      ).not.toBeInTheDocument();
    });

    it("should show clear button when value is set", () => {
      render(
        <CreatedByFilter
          value="john.doe"
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Clear user filter" }),
      ).toBeInTheDocument();
    });

    it("should populate input with current value", () => {
      render(
        <CreatedByFilter
          value="existing-user"
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(screen.getByPlaceholderText("Search by user...")).toHaveValue(
        "existing-user",
      );
    });
  });

  describe("typing behavior", () => {
    it("should call onChange when typing", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <CreatedByFilter
          value={undefined}
          onChange={onChange}
          onClear={vi.fn()}
        />,
      );

      await user.type(screen.getByPlaceholderText("Search by user..."), "jane");

      // Called for each character typed
      expect(onChange).toHaveBeenCalledTimes(4);
      expect(onChange).toHaveBeenLastCalledWith("jane");
    });

    it("should call onChange with undefined when input is cleared by typing", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <CreatedByFilter value="j" onChange={onChange} onClear={vi.fn()} />,
      );

      await user.clear(screen.getByPlaceholderText("Search by user..."));

      expect(onChange).toHaveBeenLastCalledWith(undefined);
    });
  });

  describe("clear button behavior", () => {
    it("should call onClear and clear input when clear button is clicked", async () => {
      const user = userEvent.setup();
      const onClear = vi.fn();
      render(
        <CreatedByFilter
          value="john.doe"
          onChange={vi.fn()}
          onClear={onClear}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "Clear user filter" }),
      );

      expect(onClear).toHaveBeenCalled();
    });

    it("should hide clear button after clearing", async () => {
      const user = userEvent.setup();
      render(
        <CreatedByFilter
          value="john.doe"
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "Clear user filter" }),
      );

      expect(
        screen.queryByRole("button", { name: "Clear user filter" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("external value sync", () => {
    it("should sync input when value prop changes", () => {
      const { rerender } = render(
        <CreatedByFilter
          value="initial"
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(screen.getByPlaceholderText("Search by user...")).toHaveValue(
        "initial",
      );

      rerender(
        <CreatedByFilter
          value="updated"
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(screen.getByPlaceholderText("Search by user...")).toHaveValue(
        "updated",
      );
    });

    it("should clear input when value prop becomes undefined", () => {
      const { rerender } = render(
        <CreatedByFilter
          value="some-user"
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      rerender(
        <CreatedByFilter
          value={undefined}
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(screen.getByPlaceholderText("Search by user...")).toHaveValue("");
    });
  });
});
