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
    extraData: null,
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

const groupHeadings = () =>
  [...document.querySelectorAll("th[scope='rowgroup']")].map(
    (heading) => heading.textContent,
  );

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

  it("gathers each kind of item under a heading that counts it", () => {
    mockResources({
      items: [
        resource({ id: "a", entity: "pipeline", name: "churn-training" }),
        resource({ id: "b", entity: "document", name: "Model card" }),
        resource({ id: "c", entity: "document", name: "readme.md" }),
      ],
      totalCount: 3,
    });
    renderResources();

    expect(screen.getByText("Pipelines (1)")).toBeInTheDocument();
    expect(screen.getByText("Documents (2)")).toBeInTheDocument();
    expect(screen.getByText("churn-training")).toBeInTheDocument();
    expect(screen.getByText("Model card")).toBeInTheDocument();
  });

  it("orders the groups the way the rest of the app names them", () => {
    mockResources({
      items: [
        resource({ id: "a", entity: "document", name: "Model card" }),
        resource({ id: "b", entity: "agent_session", name: "Tuesday" }),
        resource({ id: "c", entity: "pipeline", name: "churn-training" }),
      ],
      totalCount: 3,
    });
    renderResources();

    expect(groupHeadings()).toEqual([
      "Pipelines (1)",
      "Agent sessions (1)",
      "Documents (1)",
    ]);
  });

  it("puts a kind it does not recognise after the ones it does", () => {
    mockResources({
      items: [
        resource({ id: "a", entity: "widget", name: "Gadget" }),
        resource({ id: "b", entity: "document", name: "Model card" }),
      ],
      totalCount: 2,
    });
    renderResources();

    expect(groupHeadings()).toEqual(["Documents (1)", "Widgets (1)"]);
  });

  /**
   * The API has to file a browser-held pipeline as a document, but a reader
   * looking for their pipelines should find it with the pipelines.
   */
  it("files a pipeline held in this browser with the pipelines", () => {
    mockResources({
      items: [
        resource({
          id: "a",
          entity: "pipeline",
          name: "on the backend",
          entityId: "pipeline-9",
        }),
        resource({
          id: "b",
          entity: "document",
          name: "in this browser",
          entityId: null,
          extraData: { kind: "pipeline", localName: "in this browser" },
        }),
        resource({ id: "c", entity: "document", name: "Model card" }),
      ],
      totalCount: 3,
    });
    renderResources();

    expect(groupHeadings()).toEqual(["Pipelines (2)", "Documents (1)"]);
  });

  it("promises a pipeline it only names is left in this browser", async () => {
    mockResources({
      items: [
        resource({
          entity: "document",
          name: "Churn model",
          entityId: null,
          extraData: { kind: "pipeline", localName: "Churn model" },
        }),
      ],
      totalCount: 1,
    });
    renderResources();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", {
        name: "Remove Churn model from this project",
      }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("stays in this browser");
    expect(dialog).not.toHaveTextContent(/only copy/);
  });

  it("gives the columns headings of their own", () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources();

    expect(
      screen.getAllByRole("columnheader").map((heading) => heading.textContent),
    ).toEqual(["Name", "Added", "Actions"]);
  });

  it("leaves out a kind the project holds none of", () => {
    mockResources({
      items: [resource({ id: "a", entity: "document", name: "Model card" })],
      totalCount: 1,
    });
    renderResources();

    expect(screen.queryByText(/Pipelines/)).toBeNull();
    expect(screen.queryByText(/Agent sessions/)).toBeNull();
  });

  it("previews the item that was picked", async () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Model card" }));

    expect(onSelect).toHaveBeenCalledWith("resource-1");
  });

  it("lets the item already being previewed be picked off again", async () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources("resource-1");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Model card" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("promises an item it only points at is left where it lives", async () => {
    mockResources({
      items: [
        resource({ entity: "pipeline", name: "churn", entityId: "pipeline-9" }),
      ],
      totalCount: 1,
    });
    renderResources();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Remove churn from this project" }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent('Remove "churn" from this project?');
    expect(dialog).toHaveTextContent(/item itself is not deleted/);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith("resource-1", expect.anything());
  });

  it("warns that removing an item it holds outright destroys it", async () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete Model card" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent('Delete "Model card"?');
    expect(dialog).toHaveTextContent(/only copy/);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate).toHaveBeenCalledWith("resource-1", expect.anything());
  });

  it("stops previewing an item it just removed", async () => {
    mockResources({ items: [resource()], totalCount: 1 });
    renderResources("resource-1");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete Model card" }));
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

    await user.click(screen.getByRole("button", { name: "Delete Model card" }));
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
