import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import type { Project } from "@/services/projects/types";
import { useUpdateProjectMetadata } from "@/services/projects/useProjects";

import { useRenameProjectAction } from "./useRenameProjectAction";

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@/services/projects/useProjects", () => ({
  useUpdateProjectMetadata: vi.fn(),
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
  metadata: null,
};

function Subject({ subject }: { subject: Project }) {
  const rename = useRenameProjectAction(subject);

  return <button onClick={() => void rename()}>Rename project</button>;
}

async function openRename(overrides: Partial<Project> = {}) {
  vi.mocked(useUpdateProjectMetadata).mockReturnValue({
    mutate,
  } as unknown as ReturnType<typeof useUpdateProjectMetadata>);

  const user = userEvent.setup();
  render(
    <DialogProvider disableRouterSync>
      <Subject subject={{ ...project, ...overrides }} />
    </DialogProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Rename project" }));
  return user;
}

async function submitName(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), name);
  await user.click(screen.getByRole("button", { name: "Rename" }));
}

async function renameTo(name: string, overrides: Partial<Project> = {}) {
  const user = await openRename(overrides);
  await submitName(user, name);

  await waitFor(() => expect(mutate).toHaveBeenCalled());
}

function changeAsked(): (metadata: Project["metadata"]) => unknown {
  return mutate.mock.calls[0][0].change;
}

describe("useRenameProjectAction", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renames the project to the new name", async () => {
    await renameTo("Churn model v2");

    expect(mutate).toHaveBeenCalledWith(
      {
        id: "project-1",
        name: "Churn model v2",
        change: expect.any(Function),
      },
      expect.anything(),
    );
    expect(changeAsked()(null)).toEqual({});
  });

  /** A name someone typed is deliberate, so the agent stops offering one. */
  it("drops the provisional mark, keeping the rest of the project's data", async () => {
    await renameTo("Churn model v2", {
      metadata: { provisionalName: true, startingModel: "openai/gpt-5.6" },
    });

    expect(
      changeAsked()({
        provisionalName: true,
        startingModel: "openai/gpt-5.6",
      }),
    ).toEqual({ startingModel: "openai/gpt-5.6" });
  });

  /**
   * A stale copy would drop keys written since, like the shared folder id, so
   * the change is made to whatever the project holds when it's saved rather
   * than to the copy this page loaded.
   */
  it("keeps metadata written since the project was loaded", async () => {
    await renameTo("Churn model v2", { metadata: { provisionalName: true } });

    expect(
      changeAsked()({
        provisionalName: true,
        tangentSharedFolderId: "folder-1",
      }),
    ).toEqual({ tangentSharedFolderId: "folder-1" });
  });

  it("notes why in the console when the rename fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await renameTo("Churn model v2");

    const [, options] = mutate.mock.calls[0];
    options.onError(new Error("down"));

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to rename the project",
      expect.any(Error),
    );
    expect(notify).not.toHaveBeenCalledWith("Project renamed", "success");
    consoleError.mockRestore();
  });

  it("says so once the rename lands", async () => {
    await renameTo("Churn model v2");

    const [, options] = mutate.mock.calls[0];
    options.onSuccess();

    expect(notify).toHaveBeenCalledWith("Project renamed", "success");
    expect(track).toHaveBeenCalledWith("projects.rename_project_completed");
  });

  it("leaves the project alone when cancelled", async () => {
    const user = await openRename();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Churn model v2");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("leaves the project alone when the name was not changed", async () => {
    const user = await openRename();

    await user.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
    expect(mutate).not.toHaveBeenCalled();
  });
});
