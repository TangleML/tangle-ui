import assert from "node:assert/strict";
import { test } from "node:test";

import { resourceKind, resourceWebPath } from "./resourceKinds.ts";

test("resourceKind prefers the data type over the entity", () => {
  assert.equal(
    resourceKind({ entity: "document", metadata: { type: "pipeline_run" } })
      .label,
    "Run",
  );
  assert.equal(
    resourceKind({ entity: "document", metadata: null }).label,
    "Document",
  );
  assert.equal(
    resourceKind({ entity: "pipeline", metadata: { type: "unheard_of" } })
      .label,
    "Pipeline",
  );
  assert.equal(
    resourceKind({ entity: "new", metadata: null }).label,
    "Resource",
  );
});

test("resourceWebPath opens runs and named pipelines, else the project", () => {
  assert.equal(
    resourceWebPath("p1", {
      entity: "document",
      metadata: { type: "pipeline_run", identity: "run://id/r 1" },
    }),
    "/runs/r%201",
  );
  assert.equal(
    resourceWebPath("p1", {
      entity: "document",
      metadata: { type: "local_pipeline", identity: "pipeline://name/My flow" },
    }),
    "/editor/My%20flow",
  );
  assert.equal(
    resourceWebPath("p1", {
      entity: "document",
      metadata: {
        type: "local_pipeline",
        identity: "pipeline://id/abc",
        fallbackName: "Old name",
      },
    }),
    "/editor/Old%20name",
  );
  assert.equal(
    resourceWebPath("p/1", {
      entity: "document",
      metadata: { type: "document" },
    }),
    "/projects/p%2F1",
  );
});
