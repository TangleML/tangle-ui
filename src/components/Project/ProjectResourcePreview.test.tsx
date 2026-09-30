import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalPipeline } from "@/services/localPipelines/useLocalPipelines";
import type { ProjectResource } from "@/services/projects/types";
import { useProjectResource } from "@/services/projects/useProjectResources";
import { usePipelineSpec } from "@/services/usePipelineSpec";

import { ProjectResourcePreview } from "./ProjectResourcePreview";

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResource: vi.fn(),
}));

vi.mock("@/services/usePipelineSpec", () => ({
  usePipelineSpec: vi.fn(),
}));

vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useLocalPipeline: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/routes/editorRoutes", () => ({
  getDefaultEditorPath: (name: string) => `/editor/${name}`,
}));

vi.mock("./RunPipelineButton", () => ({
  RunPipelineButton: ({
    projectId,
    spec,
  }: {
    projectId: string;
    spec: { name?: string };
  }) => (
    <button type="button" data-project={projectId} data-spec={spec.name}>
      Run pipeline
    </button>
  ),
}));

vi.mock("@/components/shared/CodeViewer", () => ({
  CodeViewer: ({
    code,
    language,
    filename,
  }: {
    code: string;
    language: string;
    filename: string;
  }) => (
    <div data-testid="code-viewer" data-language={language}>
      <span>{filename}</span>
      <pre>{code}</pre>
    </div>
  ),
}));

function resource(overrides: Partial<ProjectResource> = {}): ProjectResource {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "readme.md",
    entityId: null,
    extraData: null,
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-09T10:00:00Z"),
    updatedAt: new Date("2026-09-09T10:00:00Z"),
    payload: { content: "# Hello" },
    ...overrides,
  };
}

function mockResource(overrides: Partial<ProjectResource> = {}) {
  vi.mocked(useProjectResource).mockReturnValue({
    data: resource(overrides),
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useProjectResource>);
}

function mockSpec(
  value: Partial<ReturnType<typeof usePipelineSpec>> = {},
): void {
  vi.mocked(usePipelineSpec).mockReturnValue({
    data: {
      editorName: "churn training",
      spec: {
        name: "Churn training",
        implementation: { graph: { tasks: {} } },
      },
    },
    isPending: false,
    error: null,
    ...value,
  } as unknown as ReturnType<typeof usePipelineSpec>);
}

function mockLocalPipeline(
  pipeline: { name: string; yaml: string; spec: unknown } | null,
) {
  vi.mocked(useLocalPipeline).mockReturnValue({
    data: pipeline,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useLocalPipeline>);
}

const localPipeline = (name: string, spec: unknown = { name }) => ({
  name,
  yaml: `name: ${name}\n`,
  spec,
});

function mockPipeline() {
  mockResource({
    entity: "pipeline",
    name: "churn-training-v2",
    entityId: "pipeline-1",
    payload: null,
  });
}

function renderPreview(resourceId: string | null) {
  return render(
    <ProjectResourcePreview projectId="project-1" resourceId={resourceId} />,
  );
}

const viewer = () => screen.getByTestId("code-viewer");

describe("ProjectResourcePreview", () => {
  beforeEach(() => {
    mockResource();
    mockSpec();
    mockLocalPipeline(localPipeline("churn training"));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("asks for a selection before fetching anything", () => {
    renderPreview(null);

    expect(
      screen.getByText("Select a resource to preview it here."),
    ).toBeInTheDocument();
    expect(useProjectResource).not.toHaveBeenCalled();
  });

  it("shows a document's own body", () => {
    renderPreview("resource-1");

    expect(viewer()).toHaveTextContent("# Hello");
    expect(viewer()).toHaveTextContent("readme.md");
  });

  it("highlights a document by the language its name implies", () => {
    renderPreview("resource-1");

    expect(viewer()).toHaveAttribute("data-language", "markdown");
  });

  it("falls back to plain text for a name that says nothing", () => {
    mockResource({ name: "Model card" });
    renderPreview("resource-1");

    expect(viewer()).toHaveAttribute("data-language", "plaintext");
  });

  it("shows a pipeline as the yaml of its spec", () => {
    mockResource({
      entity: "pipeline",
      name: "churn-training-v2",
      entityId: "pipeline-1",
      payload: null,
    });
    renderPreview("resource-1");

    expect(usePipelineSpec).toHaveBeenCalledWith("pipeline-1");
    expect(viewer()).toHaveAttribute("data-language", "yaml");
    expect(viewer()).toHaveTextContent("name: Churn training");
  });

  /**
   * The editor addresses a pipeline by name out of browser storage, so a local
   * pipeline that happens to share a backend pipeline's name is a different
   * pipeline, and linking to it opened the wrong one.
   */
  it("does not send a backend pipeline to a local one of the same name", () => {
    mockPipeline();
    mockLocalPipeline(localPipeline("churn training"));
    renderPreview("resource-1");

    expect(
      screen.queryByRole("link", { name: /Open in the editor/ }),
    ).toBeNull();
    expect(screen.getByText(/editor cannot open/)).toBeInTheDocument();
  });

  it("offers no editor link for something that is not a pipeline", () => {
    renderPreview("resource-1");

    expect(
      screen.queryByRole("link", { name: /Open in the editor/ }),
    ).toBeNull();
  });

  it("vouches for a pipeline that validates", () => {
    mockPipeline();
    mockSpec({
      data: {
        editorName: "churn training",
        spec: {
          name: "Churn training",
          implementation: {
            graph: {
              tasks: {
                Greet: {
                  componentRef: {
                    spec: {
                      name: "Greet",
                      implementation: {
                        container: { image: "python:3.11", command: ["echo"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as ReturnType<typeof usePipelineSpec>);
    renderPreview("resource-1");

    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("calls out a pipeline that does not validate", () => {
    mockPipeline();
    renderPreview("resource-1");

    expect(screen.getByText("Not valid")).toBeInTheDocument();
  });

  it("gives no verdict on a pipeline whose tasks arrived without their components", () => {
    mockPipeline();
    mockSpec({
      data: {
        editorName: "churn training",
        spec: {
          name: "Churn training",
          implementation: {
            graph: {
              tasks: { Greet: { componentRef: { url: "https://x.test/c" } } },
            },
          },
        },
      },
    } as unknown as ReturnType<typeof usePipelineSpec>);
    renderPreview("resource-1");

    expect(screen.queryByText("Valid")).toBeNull();
    expect(screen.queryByText("Not valid")).toBeNull();
  });

  it("says nothing about the validity of something that is not a pipeline", () => {
    renderPreview("resource-1");

    expect(screen.queryByText(/valid/i)).toBeNull();
  });

  it("offers to run a pipeline the backend holds, into this project", () => {
    mockPipeline();
    renderPreview("resource-1");

    const run = screen.getByRole("button", { name: "Run pipeline" });
    expect(run).toHaveAttribute("data-project", "project-1");
    expect(run).toHaveAttribute("data-spec", "Churn training");
  });

  it("offers no run for something that is not a pipeline", () => {
    renderPreview("resource-1");

    expect(screen.queryByRole("button", { name: "Run pipeline" })).toBeNull();
  });

  it("says why a backend pipeline cannot be opened rather than leaving a gap", () => {
    mockPipeline();
    mockLocalPipeline(null);
    renderPreview("resource-1");

    expect(
      screen.queryByRole("link", { name: /Open in the editor/ }),
    ).toBeNull();
    expect(screen.getByText(/Stored on the backend/)).toBeInTheDocument();
  });

  describe("a pipeline held in this browser", () => {
    const pointerResource = {
      entity: "document",
      name: "Churn model",
      entityId: null,
      payload: {},
      extraData: {
        kind: "pipeline",
        storage: "browser",
        localName: "Churn model",
      },
    } satisfies Partial<ProjectResource>;

    it("shows the pipeline as it is stored, not a copy of it", () => {
      mockResource(pointerResource);
      mockLocalPipeline(localPipeline("Churn model"));
      renderPreview("resource-1");

      expect(viewer()).toHaveAttribute("data-language", "yaml");
      expect(viewer()).toHaveTextContent("name: Churn model");
    });

    it("opens in the editor under the name the pipeline has now", () => {
      mockResource(pointerResource);
      mockLocalPipeline(localPipeline("Churn model v2"));
      renderPreview("resource-1");

      expect(
        screen.getByRole("link", { name: /Open in the editor/ }),
      ).toHaveAttribute("href", "/editor/Churn model v2");
    });

    it("offers to run it into this project, from the browser that holds it", () => {
      mockResource(pointerResource);
      mockLocalPipeline(localPipeline("Churn model", { name: "Churn model" }));
      renderPreview("resource-1");

      expect(
        screen.getByRole("button", { name: "Run pipeline" }),
      ).toHaveAttribute("data-project", "project-1");
    });

    /** There is nothing to submit when the pipeline is in another browser. */
    it("offers no run for a pipeline this browser does not hold", () => {
      mockResource(pointerResource);
      mockLocalPipeline(null);
      renderPreview("resource-1");

      expect(screen.queryByRole("button", { name: "Run pipeline" })).toBeNull();
    });

    it("says whether it is valid, as it would for any other pipeline", () => {
      mockResource(pointerResource);
      mockLocalPipeline(
        localPipeline("Churn model", {
          name: "Churn model",
          implementation: { graph: { tasks: {} } },
        }),
      );
      renderPreview("resource-1");

      expect(screen.getByText("Not valid")).toBeInTheDocument();
    });

    it("explains itself rather than showing an empty pipeline", () => {
      mockResource(pointerResource);
      mockLocalPipeline(null);
      renderPreview("resource-1");

      expect(screen.getByText("Not in this browser")).toBeInTheDocument();
      expect(
        screen.getByText(/alice@example.com added it/),
      ).toBeInTheDocument();
    });

    /**
     * A row that names a pipeline carries an empty payload, which the document
     * preview would happily render as the two characters "{}".
     */
    it("never renders its empty payload as content", () => {
      mockResource(pointerResource);
      mockLocalPipeline(null);
      renderPreview("resource-1");

      expect(screen.queryByTestId("code-viewer")).toBeNull();
      expect(document.body.textContent).not.toContain("{}");
    });

    it("leaves an ordinary empty document rendering as it did", () => {
      mockResource({ name: "empty.yaml", payload: {} });
      renderPreview("resource-1");

      expect(viewer()).toHaveTextContent("{}");
    });
  });

  it("says a pipeline cannot be shown rather than showing an empty viewer", () => {
    mockResource({
      entity: "pipeline",
      entityId: "pipeline-1",
      payload: null,
    });
    mockSpec({ data: undefined, error: new Error("Pipeline is gone") });
    renderPreview("resource-1");

    expect(screen.getByText("Cannot show this pipeline")).toBeInTheDocument();
    expect(screen.getByText("Pipeline is gone")).toBeInTheDocument();
  });

  it("dumps an unfamiliar payload as yaml rather than nothing", () => {
    mockResource({
      entity: "dataset",
      name: "features",
      payload: { uri: "s3://x" },
    });
    renderPreview("resource-1");

    expect(viewer()).toHaveAttribute("data-language", "yaml");
    expect(viewer()).toHaveTextContent("uri: s3://x");
  });

  it("says so when an item carries nothing to show", () => {
    mockResource({ entity: "agent_session", payload: null });
    renderPreview("resource-1");

    expect(screen.getByText("Nothing to preview")).toBeInTheDocument();
    expect(screen.queryByTestId("code-viewer")).toBeNull();
  });

  it("surfaces a failure to load the item", () => {
    vi.mocked(useProjectResource).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("Backend said no"),
    } as unknown as ReturnType<typeof useProjectResource>);
    renderPreview("resource-1");

    expect(screen.getByText("Error loading preview")).toBeInTheDocument();
  });
});
