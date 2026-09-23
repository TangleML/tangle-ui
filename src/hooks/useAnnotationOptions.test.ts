import { describe, expect, it } from "vitest";

import {
  resolveOptionsUrl,
  toAnnotationOptions,
} from "@/hooks/useAnnotationOptions";

describe("resolveOptionsUrl", () => {
  it("returns a relative url unchanged", () => {
    expect(resolveOptionsUrl("/api/regions", {})).toBe("/api/regions");
  });

  it("substitutes placeholders from the task annotations, encoded", () => {
    expect(
      resolveOptionsUrl("/api/node_pools?cluster={example.com/cluster}", {
        "example.com/cluster": "us central 1",
      }),
    ).toBe("/api/node_pools?cluster=us%20central%201");
  });

  it("is undefined while a placeholder has no value yet", () => {
    expect(
      resolveOptionsUrl("/api/node_pools?cluster={example.com/cluster}", {
        "example.com/cluster": "",
      }),
    ).toBeUndefined();
  });

  it("refuses absolute and protocol-relative urls", () => {
    expect(resolveOptionsUrl("https://evil.example/x", {})).toBeUndefined();
    expect(resolveOptionsUrl("//evil.example/x", {})).toBeUndefined();
  });
});

describe("toAnnotationOptions", () => {
  it("accepts bare strings", () => {
    expect(toAnnotationOptions(["a", "b"])).toEqual([
      { value: "a", name: "a" },
      { value: "b", name: "b" },
    ]);
  });

  it("accepts objects with name or label and an optional caption", () => {
    expect(
      toAnnotationOptions([
        { value: "us-central1", name: "US Central" },
        { value: "europe-west4", label: "EU West", caption: "default" },
        { value: "asia-east1" },
      ]),
    ).toEqual([
      { value: "us-central1", name: "US Central" },
      { value: "europe-west4", name: "EU West", caption: "default" },
      { value: "asia-east1", name: "asia-east1" },
    ]);
  });

  it("ignores anything that is not a list of options", () => {
    expect(toAnnotationOptions({ options: [] })).toEqual([]);
    expect(toAnnotationOptions([42, null, { label: "no value" }])).toEqual([]);
  });
});
