import { describe, expect, it } from "vitest";

import { projectPipelineOf } from "./pipelineResource";

const BACKEND_URL = "https://backend.example.com";
const PIPELINE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("projectPipelineOf", () => {
  it("names a browser pipeline by its storage key", () => {
    expect(
      projectPipelineOf({
        id: "file-1",
        storageKey: "Churn model",
        remote: undefined,
        isDraft: false,
      }),
    ).toEqual({ source: "local", name: "Churn model" });
  });

  it("names a backend pipeline by its id", () => {
    expect(
      projectPipelineOf({
        id: PIPELINE_ID.toUpperCase(),
        storageKey: "Churn model",
        remote: { backendUrl: BACKEND_URL, pipelineId: PIPELINE_ID },
        isDraft: false,
      }),
    ).toEqual({
      source: "remote",
      pipelineId: PIPELINE_ID,
      name: "Churn model",
    });
  });

  it("has nothing to name for a draft that has not been saved yet", () => {
    expect(
      projectPipelineOf({
        id: "draft-1",
        storageKey: "Untitled pipeline",
        remote: undefined,
        isDraft: true,
      }),
    ).toBeUndefined();
  });
});
