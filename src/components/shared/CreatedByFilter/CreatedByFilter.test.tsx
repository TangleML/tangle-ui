import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CREATED_BY_ME_FILTER_VALUE } from "@/utils/constants";

import { CreatedByFilter } from "./CreatedByFilter";

describe("CreatedByFilter", () => {
  describe("rendering", () => {
    it("should render with toggle unchecked and search input when no value", () => {
      render(<CreatedByFilter value={undefined} onChange={vi.fn()} />);

      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(screen.getByLabelText("Created by me")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search by user")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Search" }),
      ).toBeInTheDocument();
    });

    it("should show 'Created by {user}' and checked switch when value is set", () => {
      render(<CreatedByFilter value="john.doe" onChange={vi.fn()} />);

      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByLabelText("Created by john.doe")).toBeInTheDocument();
    });
  });

  describe("toggle behavior", () => {
    it("should call onChange with 'me' when toggle is turned on", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CreatedByFilter value={undefined} onChange={onChange} />);

      await user.click(screen.getByRole("switch"));

      expect(onChange).toHaveBeenCalledWith(DEFAULT_CREATED_BY_ME_FILTER_VALUE);
    });

    it("should call onChange with undefined when toggle is turned off", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <CreatedByFilter
          value={DEFAULT_CREATED_BY_ME_FILTER_VALUE}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByRole("switch"));

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("should clear filter when toggling off with existing value", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CreatedByFilter value="john.doe" onChange={onChange} />);

      await user.click(screen.getByRole("switch"));

      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });

  describe("search behavior", () => {
    it("should have search button disabled when input is empty", () => {
      render(<CreatedByFilter value={undefined} onChange={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    });

    it("should enable search button when input has text", async () => {
      const user = userEvent.setup();
      render(<CreatedByFilter value={undefined} onChange={vi.fn()} />);

      await user.type(screen.getByPlaceholderText("Search by user"), "jane");

      expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();
    });

    it("should call onChange with typed user when search clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CreatedByFilter value={undefined} onChange={onChange} />);

      await user.type(
        screen.getByPlaceholderText("Search by user"),
        "jane.doe",
      );
      await user.click(screen.getByRole("button", { name: "Search" }));

      expect(onChange).toHaveBeenCalledWith("jane.doe");
    });

    it("should call onChange when Enter is pressed in input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CreatedByFilter value={undefined} onChange={onChange} />);

      const input = screen.getByPlaceholderText("Search by user");
      await user.type(input, "jane.doe{Enter}");

      expect(onChange).toHaveBeenCalledWith("jane.doe");
    });

    it("should trim whitespace from search input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CreatedByFilter value={undefined} onChange={onChange} />);

      await user.type(
        screen.getByPlaceholderText("Search by user"),
        "  jane  ",
      );
      await user.click(screen.getByRole("button", { name: "Search" }));

      expect(onChange).toHaveBeenCalledWith("jane");
    });

    it("should not call onChange when searching with only whitespace", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CreatedByFilter value={undefined} onChange={onChange} />);

      await user.type(screen.getByPlaceholderText("Search by user"), "   ");

      // Button should still be disabled
      expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    });
  });

  describe("initial state", () => {
    it("should populate search input with current value", () => {
      render(<CreatedByFilter value="existing-user" onChange={vi.fn()} />);

      expect(screen.getByPlaceholderText("Search by user")).toHaveValue(
        "existing-user",
      );
    });
  });
});
