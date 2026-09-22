import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectResourceSummary } from "@/services/projects/types";
import { useProjectResources } from "@/services/projects/useProjectResources";

import { ResourcesWindowContent } from "./ResourcesWindowContent";

const openWorkareaTarget = vi.fn();
const deleteResource = vi.fn();

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

vi.mock("@/services/projects/useProjects", () => ({
  useProject: () => ({ data: { id: "project-1", notes: null } }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
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
  extraData: Record<string, unknown> | null,
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id,
    projectId: "project-1",
    entity: "document",
    name,
    entityId: null,
    extraData,
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
  } as unknown as ReturnType<typeof useProjectResources>);
}

describe("ResourcesWindowContent", () => {
  beforeEach(() => given());
  afterEach(() => vi.resetAllMocks());

  it("lists a pipeline the project holds", () => {
    given(
      resource("r-1", "Churn model", {
        type: "local_pipeline",
        identity: "pipeline://id/file-7",
      }),
    );

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

  it("leaves out a row it has no way to open", () => {
    given(resource("r-3", "Mystery", { type: "something_else" }));

    render(<ResourcesWindowContent />);

    expect(screen.queryByText("Mystery")).toBeNull();
  });

  it("leaves out a pipeline row whose identity is missing", () => {
    given(resource("r-4", "Broken", { type: "local_pipeline" }));

    render(<ResourcesWindowContent />);

    expect(screen.queryByText("Broken")).toBeNull();
  });

  /**
   * A project holding a backend pipeline read as though it held nothing, and
   * the fetch that would open one is coming from elsewhere.
   */
  it("lists a pipeline the backend holds, saying it cannot be opened yet", () => {
    given(backendPipeline("r-5", "Hello World"));

    render(<ResourcesWindowContent />);

    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(
      screen.getByText("Backend pipeline — not supported yet"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("open-resource-r-5")).toBeDisabled();
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
