import "fake-indexeddb/auto";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { LibraryDB } from "./storage";

const storeLibraryWithIcon = (id: string, icon: string) =>
  LibraryDB.table("component_libraries").add({
    id,
    name: id,
    icon,
    type: "github",
    knownDigests: [],
  });

describe("LibraryDB component libraries", () => {
  afterEach(async () => {
    await LibraryDB.component_libraries.clear();
  });

  afterAll(async () => {
    await LibraryDB.delete();
  });

  it("shows a library saved with the retired GitHub icon like a newly linked one", async () => {
    await storeLibraryWithIcon("old-github-library", "Github");

    expect(
      (await LibraryDB.component_libraries.get("old-github-library"))?.icon,
    ).toBe("CloudSync");
    expect(
      (await LibraryDB.component_libraries.toArray()).map(({ icon }) => icon),
    ).toEqual(["CloudSync"]);
  });

  it("keeps an icon lucide still draws", async () => {
    await storeLibraryWithIcon("starred-library", "Star");

    expect(
      (await LibraryDB.component_libraries.get("starred-library"))?.icon,
    ).toBe("Star");
  });

  it("drops an icon lucide no longer draws, leaving the folder fallback", async () => {
    await storeLibraryWithIcon("unknown-icon-library", "NotALucideIcon");

    const library = await LibraryDB.component_libraries.get(
      "unknown-icon-library",
    );

    expect(library).toBeDefined();
    expect(library?.icon).toBeUndefined();
  });
});
