import { describe, expect, it } from "vitest";

import {
  projectIdsFromAnnotations,
  projectRunAnnotationKey,
  projectRunAnnotations,
} from "./projectRunAnnotation";

const PROJECT = "035d6de5-23d6-402b-ad7e-9a7359194caf";
const OTHER = "a1a58adc-e035-47de-afea-0eef486bb82f";

describe("projectRunAnnotations", () => {
  it("names the project in the key, the way the backend reads it back", () => {
    expect(projectRunAnnotations([PROJECT])).toEqual({
      [`tangleml.com/project/project-id/${PROJECT}`]: "true",
    });
  });

  it("carries a run that belongs to more than one project", () => {
    expect(Object.keys(projectRunAnnotations([PROJECT, OTHER]))).toEqual([
      projectRunAnnotationKey(PROJECT),
      projectRunAnnotationKey(OTHER),
    ]);
  });

  it("annotates nothing when there is no project", () => {
    expect(projectRunAnnotations([])).toEqual({});
  });

  /** A blank id would key the annotation on the bare prefix, claiming a project that cannot exist. */
  it("refuses an id that says nothing", () => {
    expect(projectRunAnnotations(["", "   "])).toEqual({});
  });

  it("does not let stray whitespace make a second, different project", () => {
    expect(projectRunAnnotations([` ${PROJECT} `])).toEqual(
      projectRunAnnotations([PROJECT]),
    );
  });
});

describe("projectIdsFromAnnotations", () => {
  it("reads back what it wrote", () => {
    expect(projectIdsFromAnnotations(projectRunAnnotations([PROJECT]))).toEqual(
      [PROJECT],
    );
  });

  it("keeps every project a run belongs to, so a rerun drops none", () => {
    expect(
      projectIdsFromAnnotations(projectRunAnnotations([PROJECT, OTHER])),
    ).toEqual([PROJECT, OTHER]);
  });

  it("finds nothing on a run that belongs to no project", () => {
    expect(projectIdsFromAnnotations({ source: "web-app" })).toEqual([]);
    expect(projectIdsFromAnnotations(null)).toEqual([]);
    expect(projectIdsFromAnnotations(undefined)).toEqual([]);
  });

  /** Anything can write a run's annotations, so a key may be malformed. */
  it("ignores a key that only looks like one", () => {
    expect(
      projectIdsFromAnnotations({
        "tangleml.com/project/project-id/": "true",
        "tangleml.com/project/project-idx": "true",
        "tangleml.com/project": "true",
      }),
    ).toEqual([]);
  });

  it("reads past the system annotations a run already carries", () => {
    expect(
      projectIdsFromAnnotations({
        source: "web-app",
        "system/pipeline_run.created_by": "someone@example.com",
        "tangleml.com/user-pipeline/pipeline-id": "ab420234",
        ...projectRunAnnotations([PROJECT]),
      }),
    ).toEqual([PROJECT]);
  });
});
