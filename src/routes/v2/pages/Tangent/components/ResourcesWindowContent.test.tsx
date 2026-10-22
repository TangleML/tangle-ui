import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectResourceSummary } from "@/services/projects/types";
import { useProjectResources } from "@/services/projects/useProjectResources";

import { ResourcesWindowContent } from "./ResourcesWindowContent";

const openWorkareaTarget = vi.fn();
const deleteResource = vi.fn();
const saveInstructions = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1", openWorkareaTarget }),
}));

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResources: vi.fn(),
  useDeleteProjectResource: () => ({
    mutate: deleteResource,
    isPending: false,
  }),
}));

vi.mock("@/services/projects/useProjectInstructions", () => ({
  useProjectInstructions: () => ({
    instructions: "",
    isPending: false,
    isSaving: false,
    save: saveInstructions,
  }),
}));

vi.mock("@/providers/DialogProvider/hooks/useDialog", () => ({
  useDialog: () => ({ open: vi.fn() }),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

// The add button reaches the runs list, and through it the whole editor tree,
// which does not survive being imported on its own.
vi.mock("@/routes/v2/pages/Tangent/components/AddResourceButton", () => ({
  AddResourceButton: () => null,
}));

function resource(
  id: string,
  name: string,
  metadata: Record<string, unknown> | null,
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id,
    projectId: "project-1",
    entity: "document",
    name,
    entityId: null,
    metadata,
    createdBy: null,
    createdAt: new Date("2026-09-21T10:00:00Z"),
    updatedAt: new Date("2026-09-21T10:00:00Z"),
    ...overrides,
  };
}

const backendPipeline = (id: string, name: string) =>
  resource(id, name, null, { entity: "pipeline", entityId: "uuid-1" });

function given(...resources: ProjectResourceSummary[]) {
  vi.mocked(useProjectResources).mockReturnValue({
    data: { items: resources },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useProjectResources>);
}

describe("ResourcesWindowContent", () => {
  beforeEach(() => {
    given();
  });
  afterEach(() => vi.resetAllMocks());

  it("says it is still reading rather than showing a project as empty", () => {
    vi.mocked(useProjectResources).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useProjectResources>);

    render(<ResourcesWindowContent />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing is attached to this project yet"),
    ).not.toBeInTheDocument();
  });

  it("does not claim to be reading while the query is disabled", () => {
    vi.mocked(useProjectResources).mockReturnValue({
      data: undefined,
      isPending: true,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useProjectResources>);

    render(<ResourcesWindowContent />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("passes on why the resources could not be read", () => {
    vi.mocked(useProjectResources).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Backend is unreachable"),
    } as unknown as ReturnType<typeof useProjectResources>);

    render(<ResourcesWindowContent />);

    expect(screen.getByText("Backend is unreachable")).toBeInTheDocument();
  });

  it("says a project holds nothing only once it has been read", () => {
    render(<ResourcesWindowContent />);

    expect(
      screen.getByText("Nothing is attached to this project yet"),
    ).toBeInTheDocument();
  });

  it("lists a pipeline the project holds", () => {
    given(backendPipeline("r-1", "Churn model"));

    render(<ResourcesWindowContent />);

    expect(screen.getByText("Churn model")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });

  /** Documents were written on the project page and shown nowhere near it. */
  it("lists a document, which carries no identity of its own", async () => {
    given(resource("r-2", "Model card", { type: "document" }));
    const user = userEvent.setup();

    render(<ResourcesWindowContent />);
    expect(screen.getByText("Document")).toBeInTheDocument();

    await user.click(screen.getByTestId("open-resource-r-2"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "document", identity: "id/r-2" },
      "Model card",
    );
  });

  /** It belongs to the project, so hiding it would make the list look wrong. */
  it("lists a row it has no way to open, without offering to open it", () => {
    given(resource("r-3", "Mystery", { type: "something_else" }));

    render(<ResourcesWindowContent />);

    expect(screen.getByText("Mystery")).toBeInTheDocument();
    expect(screen.getByTestId("open-resource-r-3")).toBeDisabled();
  });

  /** A document needs no descriptor: the row is the document. */
  it("lists a document that recorded no descriptor", async () => {
    given(resource("r-5", "Loose note", null));
    const user = userEvent.setup();

    render(<ResourcesWindowContent />);
    expect(screen.getByText("Loose note")).toBeInTheDocument();

    await user.click(screen.getByTestId("open-resource-r-5"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "document", identity: "id/r-5" },
      "Loose note",
    );
  });

  it("leaves out a pipeline row whose identity is missing", () => {
    given(
      resource("r-4", "Broken", null, { entity: "pipeline", entityId: null }),
    );

    render(<ResourcesWindowContent />);

    expect(screen.queryByText("Broken")).toBeNull();
  });

  it("opens an attached remote pipeline by its server identity", async () => {
    given(backendPipeline("r-5", "Hello World"));

    render(<ResourcesWindowContent />);

    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId("open-resource-r-5"));
    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "pipeline", identity: "remote/uuid-1" },
      "Hello World",
    );
  });

  /** Unopenable is not unremovable — it can still be taken out of the project. */
  it("still lets one be removed", async () => {
    given(backendPipeline("r-5", "Hello World"));
    const user = userEvent.setup();

    render(<ResourcesWindowContent />);
    await user.click(
      screen.getByRole("button", { name: "Remove Hello World" }),
    );

    expect(deleteResource).toHaveBeenCalledWith("r-5");
  });

  it("asks for both the documents and the pipelines a project holds", () => {
    render(<ResourcesWindowContent />);

    expect(useProjectResources).toHaveBeenCalledWith("project-1", {
      entity: ["document", "pipeline"],
    });
  });
});
