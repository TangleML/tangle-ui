import { describe, expect, it } from "vitest";

import { pipelinePickerQuery } from "./pipelinePickerQuery";

const ID = "71c26504-e061-4edb-a2f8-846bc960f8b2";

function predicates(query: string | undefined) {
  return query === undefined ? [] : JSON.parse(query).and;
}

describe("pipelinePickerQuery", () => {
  it("lists only the caller's pipelines when nothing is typed", () => {
    expect(predicates(pipelinePickerQuery("  ", true))).toEqual([
      { value_equals: { key: "system/pipeline.user_id", value: "me" } },
    ]);
  });

  it("lists everyone's pipelines when not limited to the caller", () => {
    expect(pipelinePickerQuery("", false)).toBeUndefined();
  });

  it("searches names by substring", () => {
    expect(predicates(pipelinePickerQuery(" taxi ", false))).toEqual([
      {
        value_contains: {
          key: "system/pipeline.name",
          value_substring: "taxi",
        },
      },
    ]);
  });

  it.each([ID, ID.toUpperCase(), ID.replaceAll("-", ""), `{${ID}}`])(
    "searches a complete ID by ID: %s",
    (search) => {
      expect(predicates(pipelinePickerQuery(search, true))).toEqual([
        { value_equals: { key: "system/pipeline.id", value: ID } },
        { value_equals: { key: "system/pipeline.user_id", value: "me" } },
      ]);
    },
  );

  it("searches a partial ID as a name", () => {
    expect(predicates(pipelinePickerQuery("71c26504", false))).toEqual([
      {
        value_contains: {
          key: "system/pipeline.name",
          value_substring: "71c26504",
        },
      },
    ]);
  });
});
