import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResolvedPointers } from "@/services/localPipelines/useLocalPipelines";
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

vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useResolvedPointers: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => ({ data: { id: "ada@example.com", permissions: [] } }),
}));

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

const localPipeline = (
  id: string,
  name: string,
  overrides: Partial<ProjectResourceSummary> = {},
) =>
  resource(
    id,
    name,
    {
      type: "local_pipeline",
      storage: "browser",
      identity: `pipeline://name/${name}`,
      fallbackName: name,
    },
    overrides,
  );

function given(...resources: ProjectResourceSummary[]) {
  vi.mocked(useProjectResources).mockReturnValue({
    data: { items: resources },
  } as unknown as ReturnType<typeof useProjectResources>);
}

/** Which pointers this browser holds, keyed as `localName|localId`. */
function browserHolds(resolved: Record<string, string | null>) {
  vi.mocked(useResolvedPointers).mockReturnValue({
    data: resolved,
  } as unknown as ReturnType<typeof useResolvedPointers>);
}

describe("ResourcesWindowContent", () => {
  beforeEach(() => {
    given();
    browserHolds({});
  });
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

  /**
   * A project is shareable but the pipelines inside it are not: one lives in
   * the browser it was made in. Everyone else needs telling, rather than a row
   * that opens a tab and collapses into an error icon.
   */
  it("greys out a pipeline held in some other browser", () => {
    given(localPipeline("r-6", "Ada's preprocessing"));
    browserHolds({ "Ada's preprocessing|": null });

    render(<ResourcesWindowContent />);

    expect(
      screen.getByText("Pipeline — not in this browser"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("open-resource-r-6")).toBeDisabled();
  });

  it("leaves a pipeline this browser does hold alone", async () => {
    given(localPipeline("r-7", "Churn model"));
    browserHolds({ "Churn model|": "Churn model" });
    const user = userEvent.setup();

    render(<ResourcesWindowContent />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();

    await user.click(screen.getByTestId("open-resource-r-7"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "pipeline", identity: "name/Churn model" },
      "Churn model",
    );
  });

  it("still lets an absent pipeline be removed", async () => {
    given(localPipeline("r-6", "Ada's preprocessing"));
    browserHolds({ "Ada's preprocessing|": null });
    const user = userEvent.setup();

    render(<ResourcesWindowContent />);
    await user.click(
      screen.getByRole("button", { name: "Remove Ada's preprocessing" }),
    );

    expect(deleteResource).toHaveBeenCalledWith("r-6");
  });

  /**
   * A pointer that recorded no id has only a name to go on, and a name is
   * this browser's to recognise only if this browser wrote it. Someone else's
   * "Churn model" is not the "Churn model" sitting here.
   */
  it("does not trust a bare name that someone else recorded", () => {
    given(localPipeline("r-8", "Churn model", { createdBy: "bo@example.com" }));
    browserHolds({ "Churn model|": "Churn model" });

    render(<ResourcesWindowContent />);

    expect(
      screen.getByText("Pipeline — not in this browser"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("open-resource-r-8")).toBeDisabled();
  });

  it("trusts a bare name this browser recorded itself", () => {
    given(
      localPipeline("r-9", "Churn model", { createdBy: "ada@example.com" }),
    );
    browserHolds({ "Churn model|": "Churn model" });

    render(<ResourcesWindowContent />);

    expect(screen.getByTestId("open-resource-r-9")).toBeEnabled();
  });

  /** A local read, so a moment of "unavailable" on every row would just flicker. */
  it("assumes nothing while the lookup is still running", () => {
    given(localPipeline("r-7", "Churn model"));
    vi.mocked(useResolvedPointers).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useResolvedPointers>);

    render(<ResourcesWindowContent />);

    expect(screen.getByTestId("open-resource-r-7")).toBeEnabled();
  });

  it("asks for both the documents and the pipelines a project holds", () => {
    render(<ResourcesWindowContent />);

    expect(useProjectResources).toHaveBeenCalledWith("project-1", {
      entity: ["document", "pipeline"],
    });
  });
});
