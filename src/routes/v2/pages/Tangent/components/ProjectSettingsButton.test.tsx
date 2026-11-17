import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectSettingsButton } from "./ProjectSettingsButton";

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1" }),
}));

interface ReadLocalEnv {
  localEnv: { baseUrl: string };
}

vi.mock("./LocalEnvIndicator", () => ({
  useLocalEnv: (projectId: string) => ({
    baseUrl: `http://tangent/${projectId}`,
  }),
  LocalEnvStatus: ({
    onOpen,
    localEnv,
  }: ReadLocalEnv & { onOpen: () => void }) => (
    <button type="button" onClick={onOpen} data-read-from={localEnv.baseUrl}>
      Connected to VS Code
    </button>
  ),
}));

vi.mock("./ProjectSettingsDialog", () => ({
  ProjectSettingsDialog: ({
    open,
    localEnv,
  }: ReadLocalEnv & { open: boolean }) =>
    open ? (
      <div
        role="dialog"
        aria-label="Project settings"
        data-read-from={localEnv.baseUrl}
      />
    ) : null,
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

  /** Each read of the connected editors holds a socket open to Tangent. */
  it("hands one read of the connected editors to both the plug and the dialog", async () => {
    const user = userEvent.setup();
    render(<ProjectSettingsButton />);

    await user.click(screen.getByRole("button", { name: "Project settings" }));

    expect(
      screen.getByRole("button", { name: "Connected to VS Code" }),
    ).toHaveAttribute("data-read-from", "http://tangent/project-1");
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-read-from",
      "http://tangent/project-1",
    );
  });
});
