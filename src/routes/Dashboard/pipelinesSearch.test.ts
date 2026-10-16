import { format } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  getRemotePipelinesFilterQuery,
  validatePipelinesSearch,
} from "./pipelinesSearch";

describe("validatePipelinesSearch", () => {
  it.each([1, "2", 1000000, 0, -2, 1.5, "invalid", "9007199254740992"])(
    "discards obsolete page value %s while preserving filters and other parameters",
    (page) => {
      const search = validatePipelinesSearch({
        page,
        tab: "remote",
        name: "shared",
        panel: "compact",
      });

      expect(search).not.toHaveProperty("page");
      expect(search).toMatchObject({
        tab: "remote",
        name: "shared",
        panel: "compact",
      });
    },
  );

  it("discards malformed text and date parameter types", () => {
    const search = validatePipelinesSearch({
      name: ["pipeline"],
      id: 123,
      user: true,
      createdFrom: {},
      createdTo: ["2026-10-13"],
      updatedFrom: null,
      updatedTo: 20261013,
    });

    expect(search.name).toBeUndefined();
    expect(search.id).toBeUndefined();
    expect(search.user).toBeUndefined();
    expect(search.createdFrom).toBeUndefined();
    expect(search.createdTo).toBeUndefined();
    expect(search.updatedFrom).toBeUndefined();
    expect(search.updatedTo).toBeUndefined();
  });

  it("accepts leap dates and same-day ranges", () => {
    const dates = {
      createdFrom: "2024-02-29",
      createdTo: "2024-03-01",
      updatedFrom: "2026-10-13",
      updatedTo: "2026-10-13",
    };

    expect(validatePipelinesSearch(dates)).toMatchObject(dates);
  });

  it.each([
    "0000-01-01",
    "2026-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-2-03",
    "2026-02-03T00:00:00Z",
    " 2026-02-03 ",
  ])("rejects malformed calendar date %s", (date) => {
    const search = validatePipelinesSearch({
      createdFrom: date,
      createdTo: "2026-12-31",
      updatedFrom: "2026-01-01",
      updatedTo: date,
    });

    expect(search.createdFrom).toBeUndefined();
    expect(search.createdTo).toBeUndefined();
    expect(search.updatedFrom).toBe("2026-01-01");
    expect(search.updatedTo).toBeUndefined();
  });

  it("discards end-only ranges and keeps only the start of reversed ranges", () => {
    const search = validatePipelinesSearch({
      createdTo: "2026-10-13",
      updatedFrom: "2026-10-13",
      updatedTo: "2026-10-12",
    });

    expect(search.createdFrom).toBeUndefined();
    expect(search.createdTo).toBeUndefined();
    expect(search.updatedFrom).toBe("2026-10-13");
    expect(search.updatedTo).toBeUndefined();
  });
});

describe("getRemotePipelinesFilterQuery", () => {
  it.each([
    { date: "2026-03-08", month: 2, day: 8 },
    { date: "2026-11-01", month: 10, day: 1 },
  ])("preserves local calendar bounds for $date", ({ date, month, day }) => {
    const from = new Date(2026, month, day);
    const nextDay = new Date(2026, month, day + 1);
    const search = validatePipelinesSearch({
      createdFrom: format(from, "yyyy-MM-dd"),
      createdTo: date,
      updatedFrom: date,
      updatedTo: date,
    });

    expect(search.createdFrom).toBe(date);
    expect(search.createdTo).toBe(date);
    expect(getRemotePipelinesFilterQuery(search)).toBe(
      JSON.stringify({
        and: [
          {
            time_range: {
              key: "system/pipeline.date.created_at",
              start_time: from.toISOString(),
              end_time: nextDay.toISOString(),
            },
          },
          {
            time_range: {
              key: "system/pipeline.date.updated_at",
              start_time: from.toISOString(),
              end_time: nextDay.toISOString(),
            },
          },
        ],
      }),
    );
  });
});
