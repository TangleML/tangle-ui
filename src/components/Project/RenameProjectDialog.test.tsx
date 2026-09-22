import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/services/projects/types";
import { useUpdateProject } from "@/services/projects/useProjects";

import { RenameProjectDialog } from "./RenameProjectDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const onOpenChange = vi.fn();

vi.mock("@/services/projects/useProjects", () => ({
  useUpdateProject: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: null,
  createdBy: "alice@example.com",
  origin: "user",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: {},
  notes: null,
  extraData: null,
};

function renderDialog({ isPending = false } = {}) {
  vi.mocked(useUpdateProject).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useUpdateProject>);

  return render(
    <RenameProjectDialog project={project} open onOpenChange={onOpenChange} />,
  );
}

const nameField = () => screen.getByLabelText("Name");
const renameButton = () => screen.getByRole("button", { name: "Rename" });

describe("RenameProjectDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("opens on the name the project already has", () => {
    renderDialog();

    expect(nameField()).toHaveValue("Churn model");
  });

  it("renames the project to the new name", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(nameField());
    await user.type(nameField(), "Churn model v2");
    await user.click(renameButton());

    expect(mutate).toHaveBeenCalledWith(
      { id: "project-1", input: { name: "Churn model v2" } },
      expect.anything(),
    );
  });

  it("trims the name it sends", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(nameField());
    await user.type(nameField(), "  Spaced out  ");
    await user.click(renameButton());

    expect(mutate).toHaveBeenCalledWith(
      { id: "project-1", input: { name: "Spaced out" } },
      expect.anything(),
    );
  });

  it("changes nothing when the name was left alone", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(renameButton());

    expect(mutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("refuses an empty name", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(nameField());
    await user.click(renameButton());

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Name cannot be empty")).toBeInTheDocument();
  });

  it("refuses a name of nothing but spaces", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(nameField());
    await user.type(nameField(), "   ");
    await user.click(renameButton());

    expect(mutate).not.toHaveBeenCalled();
  });

  /**
   * The complaint used to appear on blur, which grew the dialog underneath a
   * pointer already on its way to Cancel and swallowed the click. Leaving the
   * field has to say nothing at all.
   */
  it("stays quiet about an empty name until Rename is pressed", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(nameField());
    await user.tab();

    expect(screen.queryByText("Name cannot be empty")).toBeNull();
  });

  it("closes and says so once the rename lands", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(nameField());
    await user.type(nameField(), "Churn model v2");
    await user.click(renameButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess();

    expect(notify).toHaveBeenCalledWith("Project renamed", "success");
    expect(track).toHaveBeenCalledWith("projects.rename_project_completed");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves the project alone when cancelled", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(nameField());
    await user.type(nameField(), "Churn model v2");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cannot be submitted twice while saving", () => {
    renderDialog({ isPending: true });

    expect(renameButton()).toBeDisabled();
  });
});
