import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { formatDate } from "@/utils/date";

import { ProjectContents } from "./ProjectContents";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResources: vi.fn(),
  useDeleteProjectResource: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function makeResource(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "pipeline",
    name: "churn-training-v2",
    entityId: "pipeline-1",
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-09T10:00:00Z"),
    updatedAt: new Date("2026-09-09T10:00:00Z"),
    ...overrides,
  };
}

function mockResources(
  items: ProjectResourceSummary[],
  overrides: Record<string, unknown> = {},
) {
  vi.mocked(useProjectResources).mockReturnValue({
    data: { items, nextPageToken: null, totalCount: items.length },
    isPending: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProjectResources>);
}

function renderContents() {
  return render(<ProjectContents projectId="project-1" />);
}

async function openRemoveConfirmation(name: string) {
  const user = userEvent.setup();
  renderContents();

  await user.click(
    screen.getByRole("button", { name: `Item actions: ${name}` }),
  );
  await user.click(await screen.findByRole("menuitem", { name: /Remove/ }));

  return screen.findByRole("alertdialog");
}

describe("ProjectContents", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useDeleteProjectResource).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteProjectResource>);
    mockResources([makeResource()]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("lists what the project holds", () => {
    renderContents();

    expect(screen.getByText("churn-training-v2")).toBeInTheDocument();
    expect(
      screen.getByText(formatDate(new Date("2026-09-09T10:00:00Z"))),
    ).toBeInTheDocument();
  });

  it("heads each kind of item with how many there are", () => {
    mockResources([
      makeResource({ id: "a", entity: "pipeline", name: "one" }),
      makeResource({ id: "b", entity: "pipeline", name: "two" }),
      makeResource({ id: "c", entity: "document", name: "a doc" }),
    ]);
    renderContents();

    expect(
      screen.getByRole("heading", { name: "Pipelines (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Document (1)" }),
    ).toBeInTheDocument();
  });

  it("names every kind of item, even the empty ones", () => {
    mockResources([]);
    renderContents();

    expect(
      screen.getByRole("heading", { name: "Pipelines" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agent sessions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Documents" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Nothing here yet")).toHaveLength(3);
  });

  it("keeps the kinds in a settled order", () => {
    mockResources([]);
    renderContents();

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual(["Pipelines", "Agent sessions", "Documents"]);
  });

  it("shows an item nobody named as untitled", () => {
    mockResources([makeResource({ name: null })]);
    renderContents();

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("finds room for a kind of item it was not expecting", () => {
    mockResources([makeResource({ entity: "dataset", name: "customers" })]);
    renderContents();

    expect(
      screen.getByRole("heading", { name: "Dataset (1)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("customers")).toBeInTheDocument();
  });

  it("promises not to delete what an item points at", async () => {
    const dialog = await openRemoveConfirmation("churn-training-v2");

    expect(dialog).toHaveTextContent(
      'Remove "churn-training-v2" from this project?',
    );
    expect(dialog).toHaveTextContent(
      "It does not delete what the item points at.",
    );
  });

  it("removes the item once the warning is accepted", async () => {
    await openRemoveConfirmation("churn-training-v2");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith("resource-1", expect.anything());
    });

    const [, options] = mutate.mock.calls[0];
    options.onSuccess();

    expect(notify).toHaveBeenCalledWith("Removed from project", "success");
    expect(track).toHaveBeenCalledWith("projects.remove_resource_completed", {
      entity: "pipeline",
    });
  });

  it("keeps the item when the warning is dismissed", async () => {
    await openRemoveConfirmation("churn-training-v2");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("waits on the contents rather than calling the project empty", () => {
    mockResources([], { data: undefined, isPending: true });
    renderContents();

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet")).toBeNull();
  });

  it("reports a failure to load the contents", () => {
    mockResources([], {
      data: undefined,
      isPending: false,
      error: new Error("resources exploded"),
    });
    renderContents();

    expect(screen.getByText("Error loading contents")).toBeInTheDocument();
    expect(screen.getByText("resources exploded")).toBeInTheDocument();
  });

  it("admits when it has not listed everything", () => {
    mockResources([makeResource()], {
      data: {
        items: [makeResource()],
        nextPageToken: "next",
        totalCount: 140,
      },
    });
    renderContents();

    expect(
      screen.getByText("Showing the first 1 of 140 items."),
    ).toBeInTheDocument();
  });
});
