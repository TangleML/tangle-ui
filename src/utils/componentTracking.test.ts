import { describe, expect, it, vi } from "vitest";

import type { ComponentReference } from "./componentSpec";
import { componentMetadata } from "./componentTracking";

vi.mock("./getComponentName", () => ({
  getComponentName: (c: ComponentReference) => c.name ?? "fallback-name",
}));

describe("componentMetadata", () => {
  it("includes digest, name, and source", () => {
    const ref = { digest: "sha:abc", name: "foo" } as ComponentReference;
    expect(componentMetadata(ref, "library")).toEqual({
      component_id: "sha:abc",
      component_name: "foo",
      component_source: "library",
    });
  });

  it("defaults source to unknown", () => {
    const ref = { digest: "sha:abc", name: "foo" } as ComponentReference;
    expect(componentMetadata(ref).component_source).toBe("unknown");
  });

  it("handles missing digest", () => {
    const ref = { name: "foo" } as ComponentReference;
    expect(componentMetadata(ref, "user")).toEqual({
      component_id: undefined,
      component_name: "foo",
      component_source: "user",
    });
  });

  it("falls back to getComponentName when name is missing", () => {
    const ref = { digest: "sha:abc" } as ComponentReference;
    expect(componentMetadata(ref).component_name).toBe("fallback-name");
  });

  it("handles undefined ref", () => {
    expect(componentMetadata(undefined, "file")).toEqual({
      component_id: undefined,
      component_name: undefined,
      component_source: "file",
    });
  });
});
