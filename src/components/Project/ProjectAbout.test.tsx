import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/services/projects/types";
import { useUpdateProject } from "@/services/projects/useProjects";

import { ProjectAbout } from "./ProjectAbout";

const mutate = vi.fn();
const track = vi.fn();

vi.mock("@/services/projects/useProjects", () => ({
  useUpdateProject: vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Weekly churn scoring",
  createdBy: "alice@example.com",
  origin: "user",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: {},
  notes: "Retrain weekly",
};

function mockUpdate({ isPending = false } = {}) {
  vi.mocked(useUpdateProject).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useUpdateProject>);
}

function renderAbout(overrides: Partial<Project> = {}) {
  return render(<ProjectAbout project={{ ...project, ...overrides }} />);
}

const description = () => screen.getByLabelText("Description");
const notes = () => screen.getByLabelText("Notes");

describe("ProjectAbout", () => {
  beforeEach(() => {
    mockUpdate();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("shows what the project already says about itself", () => {
    renderAbout();

    expect(description()).toHaveValue("Weekly churn scoring");
    expect(notes()).toHaveValue("Retrain weekly");
  });

  it("starts empty when a project says nothing", () => {
    renderAbout({ description: null, notes: null });

    expect(description()).toHaveValue("");
    expect(notes()).toHaveValue("");
  });

  it("saves a changed description when the field is left", async () => {
    const user = userEvent.setup();
    renderAbout();

    await user.clear(description());
    await user.type(description(), "Monthly churn scoring");
    await user.tab();

    expect(mutate).toHaveBeenCalledWith(
      { id: "project-1", input: { description: "Monthly churn scoring" } },
      expect.anything(),
    );
  });

  it("saves changed notes independently of the description", async () => {
    const user = userEvent.setup();
    renderAbout();

    await user.clear(notes());
    await user.type(notes(), "Owner is the growth team");
    await user.tab();

    expect(mutate).toHaveBeenCalledWith(
      { id: "project-1", input: { notes: "Owner is the growth team" } },
      expect.anything(),
    );
  });

  it("does not save when nothing was changed", async () => {
    const user = userEvent.setup();
    renderAbout();

    await user.click(description());
    await user.tab();

    expect(mutate).not.toHaveBeenCalled();
  });

  it("treats a field emptied of text as cleared", async () => {
    const user = userEvent.setup();
    renderAbout();

    await user.clear(description());
    await user.tab();

    expect(mutate).toHaveBeenCalledWith(
      { id: "project-1", input: { description: null } },
      expect.anything(),
    );
  });

  it("does not save whitespace a user typed and then left", async () => {
    const user = userEvent.setup();
    renderAbout({ description: null });

    await user.type(description(), "   ");
    await user.tab();

    expect(mutate).not.toHaveBeenCalled();
  });

  it("trims what it saves", async () => {
    const user = userEvent.setup();
    renderAbout({ description: null });

    await user.type(description(), "  Churn work  ");
    await user.tab();

    expect(mutate).toHaveBeenCalledWith(
      { id: "project-1", input: { description: "Churn work" } },
      expect.anything(),
    );
  });

  it("reports which field was saved", async () => {
    const user = userEvent.setup();
    renderAbout();

    await user.clear(notes());
    await user.type(notes(), "Something new");
    await user.tab();

    const [, options] = mutate.mock.calls[0];
    options.onSuccess();

    expect(track).toHaveBeenCalledWith("projects.update_project_completed", {
      field: "notes",
    });
  });

  it("leaves both fields usable while a save is in flight", () => {
    mockUpdate({ isPending: true });
    renderAbout();

    expect(description()).toBeEnabled();
    expect(notes()).toBeEnabled();
  });

  it("keeps an edit to one field while the other is saving", async () => {
    const user = userEvent.setup();
    renderAbout();

    await user.clear(description());
    await user.type(description(), "Monthly churn scoring");
    await user.click(notes());
    await user.clear(notes());
    await user.type(notes(), "Owner is the growth team");
    await user.tab();

    expect(mutate).toHaveBeenNthCalledWith(
      1,
      { id: "project-1", input: { description: "Monthly churn scoring" } },
      expect.anything(),
    );
    expect(mutate).toHaveBeenNthCalledWith(
      2,
      { id: "project-1", input: { notes: "Owner is the growth team" } },
      expect.anything(),
    );
  });

  it("takes up a value that changed elsewhere", () => {
    const { rerender } = renderAbout();

    rerender(
      <ProjectAbout
        project={{ ...project, description: "Renamed remotely" }}
      />,
    );

    expect(description()).toHaveValue("Renamed remotely");
  });
});
