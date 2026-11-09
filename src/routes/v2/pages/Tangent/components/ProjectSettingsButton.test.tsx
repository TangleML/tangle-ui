import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectSettingsButton } from "./ProjectSettingsButton";

vi.mock("./LocalEnvIndicator", () => ({
  LocalEnvStatus: ({ onOpen }: { onOpen: () => void }) => (
    <button type="button" onClick={onOpen}>
      Connected to VS Code
    </button>
  ),
}));

vi.mock("./ProjectSettingsDialog", () => ({
  ProjectSettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Project settings" /> : null,
}));

describe("ProjectSettingsButton", () => {
  it("opens project settings", async () => {
    const user = userEvent.setup();
    render(<ProjectSettingsButton />);

    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Project settings" }));

    expect(
      screen.getByRole("dialog", { name: "Project settings" }),
    ).toBeInTheDocument();
  });

  it("opens project settings from the connected editor's plug", async () => {
    const user = userEvent.setup();
    render(<ProjectSettingsButton />);

    await user.click(
      screen.getByRole("button", { name: "Connected to VS Code" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Project settings" }),
    ).toBeInTheDocument();
  });
});
