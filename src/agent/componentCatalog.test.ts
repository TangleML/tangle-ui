import { describe, expect, it } from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";

import { createComponentCatalog } from "./componentCatalog";

function reference(name: string): ComponentReference {
  return {
    name,
    spec: { name, implementation: { container: { image: name } } },
  } as ComponentReference;
}

describe("createComponentCatalog", () => {
  it("hands back what it was given, whole", () => {
    const catalog = createComponentCatalog();
    const stored = reference("Filter text");

    catalog.remember("abc", stored);

    expect(catalog.lookup("abc")).toBe(stored);
  });

  it("has nothing for an id it was never given", () => {
    expect(createComponentCatalog().lookup("nope")).toBeUndefined();
  });

  it("keeps one entry per id when the same component is found twice", () => {
    const catalog = createComponentCatalog();

    catalog.remember("abc", reference("First"));
    catalog.remember("abc", reference("Second"));

    expect(catalog.size()).toBe(1);
    expect(catalog.lookup("abc")?.name).toBe("Second");
  });

  /** A long session searches repeatedly; the catalog must not grow forever. */
  it("drops the oldest entries past its limit", () => {
    const catalog = createComponentCatalog();
    for (let index = 0; index < 250; index++) {
      catalog.remember(`id-${index}`, reference(`Component ${index}`));
    }

    expect(catalog.size()).toBe(200);
    expect(catalog.lookup("id-0")).toBeUndefined();
    expect(catalog.lookup("id-249")).toBeDefined();
  });

  it("keeps a component that was searched for again", () => {
    const catalog = createComponentCatalog();
    catalog.remember("keep-me", reference("Keep me"));
    for (let index = 0; index < 199; index++) {
      catalog.remember(`id-${index}`, reference(`Component ${index}`));
    }

    catalog.remember("keep-me", reference("Keep me"));
    catalog.remember("one-more", reference("One more"));

    expect(catalog.lookup("keep-me")).toBeDefined();
  });
});
