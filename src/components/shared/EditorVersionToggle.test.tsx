import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditorVersionToggle } from "./EditorVersionToggle";

const mockNavigate = vi.fn();
let mockPathname = "/";
let mockFlagEnabled = true;

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock("./Settings/useFlags", () => ({
  useFlagValue: () => mockFlagEnabled,
}));

describe("EditorVersionToggle", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPathname = "/";
    mockFlagEnabled = true;
  });

  it("renders nothing when the v2_editor flag is disabled", () => {
    mockFlagEnabled = false;
    mockPathname = "/editor/my-pipeline";

    render(<EditorVersionToggle />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing on routes without a v1/v2 counterpart", () => {
    mockPathname = "/pipelines";

    render(<EditorVersionToggle />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["/editor/my-pipeline", "/editor-v2/my-pipeline", "Switch to new editor"],
    ["/runs/run-123", "/runs-v2/run-123", "Switch to new view"],
    ["/runs/run-123/sub-456", "/runs-v2/run-123/sub-456", "Switch to new view"],
  ])("switches %s to the new version (%s)", (from, to, label) => {
    mockPathname = from;

    render(<EditorVersionToggle />);

    const button = screen.getByRole("button", { name: label });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith({ to });
  });

  it.each([
    [
      "/editor-v2/my-pipeline",
      "/editor/my-pipeline",
      "Switch to legacy editor",
    ],
    ["/runs-v2/run-123", "/runs/run-123", "Switch to legacy view"],
    [
      "/runs-v2/run-123/sub-456",
      "/runs/run-123/sub-456",
      "Switch to legacy view",
    ],
  ])("switches %s to the legacy version (%s)", (from, to, label) => {
    mockPathname = from;

    render(<EditorVersionToggle />);

    const button = screen.getByRole("button", { name: label });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith({ to });
  });
});
