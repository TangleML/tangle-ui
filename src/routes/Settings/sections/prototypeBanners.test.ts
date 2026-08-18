import { describe, expect, it } from "vitest";

import {
  bannerText,
  bannerTimestamp,
  latestBanner,
  parseBanners,
  withNewBanner,
} from "./prototypeBanners";

const OLD = { "2026-01-01T00:00:00.000Z": "old banner" };
const NEW = { "2026-03-01T00:00:00.000Z": "new banner" };

describe("parseBanners", () => {
  it("sorts newest first", () => {
    expect(parseBanners([OLD, NEW])).toEqual([NEW, OLD]);
  });

  it("drops entries that are not single-entry string maps", () => {
    expect(
      parseBanners([OLD, null, "text", [], {}, { a: "1", b: "2" }, { c: 3 }]),
    ).toEqual([OLD]);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(parseBanners(undefined)).toEqual([]);
    expect(parseBanners({ "2026-01-01T00:00:00.000Z": "x" })).toEqual([]);
  });

  it("parses a value the settings endpoint stored as a JSON string", () => {
    expect(parseBanners(JSON.stringify([OLD, NEW]))).toEqual([NEW, OLD]);
  });

  it("returns an empty list for a string that is not JSON", () => {
    expect(parseBanners("not json")).toEqual([]);
  });
});

describe("withNewBanner", () => {
  it("prepends the new banner", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const banners = withNewBanner([NEW, OLD], "latest banner", now);

    expect(banners).toEqual([
      { "2026-06-01T00:00:00.000Z": "latest banner" },
      NEW,
      OLD,
    ]);
  });
});

describe("latestBanner", () => {
  it("returns the newest banner and its parts", () => {
    const latest = latestBanner(parseBanners([OLD, NEW]));

    expect(latest).toEqual(NEW);
    expect(bannerTimestamp(latest!)).toBe("2026-03-01T00:00:00.000Z");
    expect(bannerText(latest!)).toBe("new banner");
  });

  it("returns undefined when there are no banners", () => {
    expect(latestBanner([])).toBeUndefined();
  });
});
