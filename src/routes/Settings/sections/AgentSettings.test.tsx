import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSettings } from "./AgentSettings";

const STORAGE_KEY = "tangle.componentSearchV2.config";
const mockNotify = vi.fn();

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

describe("AgentSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockNotify.mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows inline feedback instead of saving when model is blank", () => {
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-test" },
    });
    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Enter a model id before saving."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Model id")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).not.toHaveBeenCalledWith(
      "Agent settings saved",
      "success",
    );
  });
});
