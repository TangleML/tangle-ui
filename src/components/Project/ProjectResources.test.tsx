import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProjectResourcePage,
  ProjectResourceSummary,
} from "@/services/projects/types";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";

import { ProjectResources } from "./ProjectResources";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResources: vi.fn(),
  useDeleteProjectResource: vi.fn(),
  useCreateProjectResource: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function resource(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Model card",
    entityId: null,
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-09T10:00:00Z"),
    updatedAt: new Date("2026-09-09T10:00:00Z"),
    ...overrides,
  };
}

function mockResources(page: Partial<ProjectResourcePage> = {}) {
  vi.mocked(useProjectResources).mockReturnValue({
    data: {
      items: [],
      nextPageToken: null,
      totalCount: 0,
      ...page,
    },
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useProjectResources>);
}

const onSelect = vi.fn();

function renderResources(selectedResourceId: string | null = null) {
  return render(
    <ProjectResources
      projectId="project-1"
      selectedResourceId={selectedResourceId}
      onSelect={onSelect}
    />,
  );
}

describe("ProjectResources", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useDeleteProjectResource).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteProjectResource>);
    mockResources();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("invites the first item into an empty project", () => {
    renderResources();

    expect(screen.getByText("Nothing in this project yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add/ })).toBeInTheDocument();
  });

  it("lists every kind of item together, newest first as the backend sends them", () => {
    mockResources({
      items: [
        resource({ id: "a", entity: "pipeline", name: "churn-training" }),
        resource({ id: "b", entity: "document", name: "Model card" }),
      ],
      totalCount: 2,
    });
    renderResources();

    expect(screen.getByText("churn-training")).toBeInTheDocument();
    expect(screen.getByText("Model card")).toBeInTheDocument();
  });

  it("offers no filter while every item is the same kind", () => {
    mockResources({
      items: [
        resource({ id: "a", name: "First" }),
        resource({ id: "b", name: "Second" }),
      ],
      totalCount: 2,
    });
    renderResources();

    expect(screen.queryByRole("button", { name: /^All/ })).toBeNull();
  });

  it("narrows to one kind of item, counting each", async () => {
    mockResources({
      items: [
        resource({ id: "a", entity: "pipeline", name: "churn-training" }),
        resource({ id: "b", entity: "document", name: "Model card" }),
      ],
      totalCount: 2,
    });
    renderResources();
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "All 2" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "pipeline 1" }));

    expect(screen.getByText("churn-training")).toBeInTheDocument();
    expect(screen.queryByText("Model card")).toBeNull();
  });

  it("removes an item only once the removal is confirmed", async () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Item actions: Model card" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Remove from project/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent('Remove "Model card" from this project?');

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith("resource-1", expect.anything());
  });

  it("stops previewing an item it just removed", async () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources("resource-1");
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Item actions: Model card" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Remove from project/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [, options] = mutate.mock.calls[0];
    options.onSuccess();

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("keeps the item when the removal is dismissed", async () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Item actions: Model card" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Remove from project/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("admits when it is showing only the first page", () => {
    mockResources({
      items: [resource()],
      nextPageToken: "next",
      totalCount: 140,
    });
    renderResources();

    expect(
      screen.getByText("Showing the first 1 of 140 items."),
    ).toBeInTheDocument();
  });

  it("surfaces a failure to load instead of an empty project", () => {
    vi.mocked(useProjectResources).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("Backend said no"),
    } as unknown as ReturnType<typeof useProjectResources>);
    renderResources();

    expect(screen.getByText("Error loading resources")).toBeInTheDocument();
    expect(screen.queryByText("Nothing in this project yet")).toBeNull();
  });
});
