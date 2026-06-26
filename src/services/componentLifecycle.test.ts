import { describe, expect, it } from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";

import { getComponentLifecycleInfo } from "./componentLifecycle";

function reference(
  overrides: Partial<ComponentReference> = {},
): ComponentReference {
  return {
    digest: "component-digest",
    name: "Component",
    spec: {
      name: "Component",
      implementation: { container: { image: "python:3.11" } },
    },
    ...overrides,
  };
}

describe("getComponentLifecycleInfo", () => {
  it("returns undefined when no lifecycle metadata is present", () => {
    expect(getComponentLifecycleInfo(reference())).toBeUndefined();
  });

  it("reads deprecated state from component references", () => {
    expect(getComponentLifecycleInfo(reference({ deprecated: true }))).toEqual({
      state: "deprecated",
    });
  });

  it("reads superseded state from component references", () => {
    expect(
      getComponentLifecycleInfo(reference({ superseded_by: "next-digest" })),
    ).toEqual({ state: "superseded", replacementDigest: "next-digest" });
  });

  it("reads lifecycle state from annotations", () => {
    expect(
      getComponentLifecycleInfo(
        reference({
          spec: {
            name: "Component",
            implementation: { container: { image: "python:3.11" } },
            metadata: {
              annotations: { "lifecycle.state": "deprecated" },
            },
          },
        }),
      ),
    ).toEqual({ state: "deprecated" });
  });

  it("prefers superseded state when replacement metadata exists", () => {
    expect(
      getComponentLifecycleInfo(
        reference({
          deprecated: true,
          spec: {
            name: "Component",
            implementation: { container: { image: "python:3.11" } },
            metadata: {
              annotations: { superseded_by: "replacement-digest" },
            },
          },
        }),
      ),
    ).toEqual({
      state: "superseded",
      replacementDigest: "replacement-digest",
    });
  });
});
