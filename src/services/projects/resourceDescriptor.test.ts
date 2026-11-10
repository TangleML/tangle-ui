import { describe, expect, it } from "vitest";

import {
  describeResource,
  DescriptorTooLargeError,
  documentResourceInput,
  linkedRepositoryOf,
  localPipelinePointerOf,
  localPipelineResourceInput,
  namesLocalPipeline,
  namesRepository,
  pipelineRunResourceInput,
  repositoryResourceInput,
  repositoryUrlOf,
} from "./resourceDescriptor";
import type { ProjectResourceSummary } from "./types";

function row(
  metadata: Record<string, unknown> | null,
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    metadata,
    createdBy: null,
    createdAt: new Date("2026-09-21T10:00:00Z"),
    updatedAt: new Date("2026-09-21T10:00:00Z"),
    ...overrides,
  };
}

const rowFor = (input: ReturnType<typeof localPipelineResourceInput>) =>
  row(input.metadata ?? null, { name: input.name ?? null });

describe("describeResource", () => {
  it("reads back what a browser pipeline was filed as", () => {
    const described = describeResource(
      rowFor(
        localPipelineResourceInput({
          localName: "Churn model",
          localId: "file-7",
        }),
      ),
    );

    expect(described).toEqual({
      type: "local_pipeline",
      storage: "browser",
      target: { type: "pipeline", identity: "id/file-7" },
      fallbackName: "Churn model",
    });
  });

  it("reads back a run as the run it names, and nothing more", () => {
    const input = pipelineRunResourceInput("42", "Run 42");

    expect(describeResource(row(input.metadata ?? null))).toEqual({
      type: "pipeline_run",
      target: { type: "run", identity: "id/42" },
    });
  });

  it("finds nothing to say about a row with no extra data", () => {
    expect(describeResource(row(null))).toBeUndefined();
    expect(describeResource(row({}))).toBeUndefined();
    expect(describeResource(row({ type: "" }))).toBeUndefined();
    expect(describeResource(row({ type: 7 }))).toBeUndefined();
  });

  /**
   * `data` is free-form and anyone may PATCH it, so a build that has
   * never heard of a row kind still has to render it as something.
   */
  it("passes an unfamiliar kind through rather than discarding the row", () => {
    expect(describeResource(row({ type: "sbom" }))).toEqual({ type: "sbom" });
  });

  it("ignores an identity that is not a target, rather than throwing past it", () => {
    expect(
      describeResource(row({ type: "local_pipeline", identity: "nonsense" })),
    ).toEqual({ type: "local_pipeline" });
    expect(
      describeResource(
        row({ type: "local_pipeline", identity: "pipeline://bogus/7" }),
      ),
    ).toEqual({ type: "local_pipeline" });
  });

  /** A run addressed by name is not expressible, so it must not parse as one. */
  it("rejects a target whose kind cannot take that identity", () => {
    expect(
      describeResource(row({ type: "pipeline_run", identity: "run://name/x" })),
    ).toEqual({ type: "pipeline_run" });
  });
});

describe("localPipelinePointerOf", () => {
  it("prefers the id, so a recycled name cannot mislead it", () => {
    const pointer = localPipelinePointerOf(
      rowFor(
        localPipelineResourceInput({
          localName: "Churn model",
          localId: "file-7",
        }),
      ),
    );

    expect(pointer).toEqual({ localName: "Churn model", localId: "file-7" });
  });

  it("falls back to the name for a pipeline with no registry row", () => {
    expect(
      localPipelinePointerOf(
        rowFor(localPipelineResourceInput({ localName: "Churn model" })),
      ),
    ).toEqual({ localName: "Churn model" });
  });

  /**
   * The row's `name` is a label anyone may PATCH; `fallbackName` is what the
   * pipeline was called when it was attached, which is what finds it again.
   */
  it("takes the name from the descriptor, not from the row's label", () => {
    const input = localPipelineResourceInput({
      localName: "Churn model",
      localId: "file-7",
    });

    expect(
      localPipelinePointerOf(
        row(input.metadata ?? null, { name: "Renamed by someone" }),
      ),
    ).toEqual({ localName: "Churn model", localId: "file-7" });
  });

  it("finds no pipeline in a row that names something else", () => {
    expect(
      localPipelinePointerOf(row({ type: "pipeline_run" })),
    ).toBeUndefined();
    expect(localPipelinePointerOf(row(null))).toBeUndefined();
  });

  it("finds no pipeline in a row whose descriptor points nowhere", () => {
    expect(
      localPipelinePointerOf(row({ type: "local_pipeline" })),
    ).toBeUndefined();
  });
});

describe("namesLocalPipeline", () => {
  it("is true only of a row filed as one", () => {
    expect(
      namesLocalPipeline(
        rowFor(localPipelineResourceInput({ localName: "Churn model" })),
      ),
    ).toBe(true);
    expect(namesLocalPipeline(row({ type: "pipeline_run" }))).toBe(false);
    expect(namesLocalPipeline(row(null))).toBe(false);
  });
});

describe("localPipelineResourceInput", () => {
  it("files it as a document, which is what the api accepts", () => {
    const input = localPipelineResourceInput({ localName: "Churn model" });

    expect(input.entity).toBe("document");
    expect(input.entityId).toBeUndefined();
  });

  /** A uuid here would read as a backend pipeline to every other client. */
  it("never invents a backend id", () => {
    expect(
      localPipelineResourceInput({ localName: "Churn model" }).entityId,
    ).toBeUndefined();
  });

  it("refuses a name too long to record", () => {
    expect(() =>
      localPipelineResourceInput({ localName: "p".repeat(2000) }),
    ).toThrow(DescriptorTooLargeError);
  });
});

describe("documentResourceInput", () => {
  it("files the body as the payload and says what the row is", () => {
    expect(documentResourceInput("Model card", "Trained on Q3")).toEqual({
      entity: "document",
      name: "Model card",
      payload: { content: "Trained on Q3" },
      metadata: { type: "document" },
    });
  });

  /** Both pages filter on `type`, so a document has to answer that question. */
  it("reads back as a document", () => {
    const input = documentResourceInput("Model card", "Body");

    expect(describeResource({ metadata: input.metadata ?? null })).toEqual({
      type: "document",
    });
  });
});

const WHOLE_REPOSITORY = {
  owner: "TangleML",
  repo: "pipeline_components",
  ref: null,
  path: null,
  isPrivate: false,
};

const ONE_FOLDER = {
  ...WHOLE_REPOSITORY,
  ref: "master",
  path: "components/data",
};

describe("repositoryResourceInput", () => {
  it("files a whole repository under its owner and name", () => {
    expect(repositoryResourceInput(WHOLE_REPOSITORY)).toEqual({
      entity: "document",
      name: "TangleML/pipeline_components",
      payload: {
        owner: "TangleML",
        repo: "pipeline_components",
        ref: null,
        path: null,
        private: false,
      },
      metadata: {
        type: "repository",
        url: "https://github.com/TangleML/pipeline_components",
      },
    });
  });

  it("files one folder under its path, at the branch it was linked on", () => {
    expect(repositoryResourceInput(ONE_FOLDER)).toEqual({
      entity: "document",
      name: "TangleML/pipeline_components/components/data",
      payload: {
        owner: "TangleML",
        repo: "pipeline_components",
        ref: "master",
        path: "components/data",
        private: false,
      },
      metadata: {
        type: "repository",
        url: "https://github.com/TangleML/pipeline_components/tree/master/components/data",
      },
    });
  });

  it("records a grant and whether the repository is private in the payload, not the URL", () => {
    const input = repositoryResourceInput({
      ...ONE_FOLDER,
      isPrivate: true,
      grantId: "7",
    });

    expect(input.payload).toEqual({
      owner: "TangleML",
      repo: "pipeline_components",
      ref: "master",
      path: "components/data",
      private: true,
      grantId: "7",
    });
    expect(input.metadata).toEqual(
      repositoryResourceInput(ONE_FOLDER).metadata,
    );
  });

  it("refuses a folder whose URL is too long to record", () => {
    expect(() =>
      repositoryResourceInput({ ...ONE_FOLDER, path: "a/".repeat(600) + "b" }),
    ).toThrow(DescriptorTooLargeError);
  });
});

describe("linkedRepositoryOf", () => {
  const filed = (input: ReturnType<typeof repositoryResourceInput>) => ({
    metadata: input.metadata ?? null,
    payload: input.payload ?? null,
  });

  it("reads back the repository and folder that were linked", () => {
    expect(
      linkedRepositoryOf(filed(repositoryResourceInput(ONE_FOLDER))),
    ).toEqual(ONE_FOLDER);
    expect(
      linkedRepositoryOf(filed(repositoryResourceInput(WHOLE_REPOSITORY))),
    ).toEqual(WHOLE_REPOSITORY);
  });

  it("reads back a private repository's grant", () => {
    const privateLink = { ...WHOLE_REPOSITORY, isPrivate: true, grantId: "7" };

    expect(
      linkedRepositoryOf(filed(repositoryResourceInput(privateLink))),
    ).toEqual(privateLink);
  });

  it("reads back a public repository's grant without calling it private", () => {
    const publicLink = { ...WHOLE_REPOSITORY, grantId: "7" };

    expect(
      linkedRepositoryOf(filed(repositoryResourceInput(publicLink))),
    ).toEqual(publicLink);
  });

  it("calls a link that never recorded privacy public", () => {
    expect(
      linkedRepositoryOf({
        metadata: { type: "repository" },
        payload: { owner: "TangleML", repo: "pipeline_components" },
      }),
    ).toMatchObject({ isPrivate: false });
  });

  it("finds no repository in a row that is something else", () => {
    expect(
      linkedRepositoryOf({
        metadata: { type: "document" },
        payload: { owner: "TangleML", repo: "pipeline_components" },
      }),
    ).toBeUndefined();
  });

  it("finds no repository when the payload does not name one", () => {
    expect(
      linkedRepositoryOf({ metadata: { type: "repository" }, payload: null }),
    ).toBeUndefined();
    expect(
      linkedRepositoryOf({
        metadata: { type: "repository" },
        payload: { owner: "", repo: "pipeline_components" },
      }),
    ).toBeUndefined();
  });
});

describe("repositoryUrlOf", () => {
  it("reads the URL a linked repository recorded", () => {
    expect(
      repositoryUrlOf(
        row(repositoryResourceInput(ONE_FOLDER).metadata ?? null),
      ),
    ).toBe(
      "https://github.com/TangleML/pipeline_components/tree/master/components/data",
    );
  });

  it("refuses a recorded URL that does not lead to GitHub", () => {
    expect(
      repositoryUrlOf(row({ type: "repository", url: "javascript:alert(1)" })),
    ).toBeUndefined();
  });

  it("finds no URL on a row that is not a repository", () => {
    expect(
      repositoryUrlOf(row({ type: "document", url: "https://github.com/x/y" })),
    ).toBeUndefined();
  });
});

describe("namesRepository", () => {
  it("is true only of a row filed as one", () => {
    expect(
      namesRepository(
        row(repositoryResourceInput(WHOLE_REPOSITORY).metadata ?? null),
      ),
    ).toBe(true);
    expect(namesRepository(row({ type: "document" }))).toBe(false);
    expect(namesRepository(row(null))).toBe(false);
  });
});
