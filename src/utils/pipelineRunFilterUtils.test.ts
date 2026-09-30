import { describe, expect, it } from "vitest";

import {
  countActiveFilters,
  filtersToFilterQuery,
  parseFilterParam,
  serializeFiltersToUrl,
  validateFilters,
} from "@/utils/pipelineRunFilterUtils";
import {
  SAVED_PIPELINE_ID_ANNOTATION,
  SOURCE_PIPELINE_ID_ANNOTATION,
} from "@/utils/pipelineRunSource";

const PIPELINE_ID = "47a95130-267f-4e41-9469-3a8f935f4ac3";

describe("saved pipeline run filters", () => {
  it("round-trips the saved pipeline ID through object and JSON URL filters", () => {
    const filters = {
      saved_pipeline_id: PIPELINE_ID,
      created_by: "teammate@example.com",
      sort_field: "created_at" as const,
      sort_direction: "asc" as const,
    };
    const serialized = serializeFiltersToUrl(filters);

    expect(parseFilterParam({ ...serialized })).toEqual(filters);
    expect(parseFilterParam(JSON.stringify(serialized))).toEqual(filters);
    expect(countActiveFilters(filters)).toBe(2);
  });

  it.each([
    undefined,
    null,
    42,
    [PIPELINE_ID],
    "Daily report",
    "not-a-uuid",
    `${PIPELINE_ID}-suffix`,
    `prefix-${PIPELINE_ID}`,
    `${PIPELINE_ID},${PIPELINE_ID}`,
  ])("ignores invalid saved pipeline IDs: %j", (savedPipelineId) => {
    expect(
      validateFilters({
        saved_pipeline_id: savedPipelineId,
        pipeline_name: "Daily report",
      }),
    ).toEqual({ pipeline_name: "Daily report" });
  });

  it("uses exact IDs from either source annotation, without name or substring matching", () => {
    expect(
      JSON.parse(filtersToFilterQuery({ saved_pipeline_id: PIPELINE_ID })!),
    ).toEqual({
      and: [
        {
          or: [
            {
              value_equals: {
                key: SAVED_PIPELINE_ID_ANNOTATION,
                value: PIPELINE_ID,
              },
            },
            {
              value_equals: {
                key: SOURCE_PIPELINE_ID_ANNOTATION,
                value: PIPELINE_ID,
              },
            },
          ],
        },
      ],
    });
  });

  it("combines the saved pipeline match with the existing server filters using AND", () => {
    expect(
      JSON.parse(
        filtersToFilterQuery({
          saved_pipeline_id: PIPELINE_ID,
          created_by: "me",
          pipeline_name: "Daily",
          annotations: [{ key: "team", value: "data" }, { key: "release" }],
          created_after: "2026-09-01T00:00:00Z",
        })!,
      ),
    ).toEqual({
      and: [
        {
          value_equals: { key: "system/pipeline_run.created_by", value: "me" },
        },
        {
          value_contains: {
            key: "system/pipeline_run.name",
            value_substring: "Daily",
          },
        },
        {
          or: [SAVED_PIPELINE_ID_ANNOTATION, SOURCE_PIPELINE_ID_ANNOTATION].map(
            (key) => ({ value_equals: { key, value: PIPELINE_ID } }),
          ),
        },
        {
          time_range: {
            key: "system/pipeline_run.date.created_at",
            start_time: "2026-09-01T00:00:00Z",
          },
        },
        { value_contains: { key: "team", value_substring: "data" } },
        { key_exists: { key: "release" } },
      ],
    });
  });

  it("does not submit an invalid ID supplied directly to the query builder", () => {
    expect(
      filtersToFilterQuery({ saved_pipeline_id: `${PIPELINE_ID}-suffix` }),
    ).toBeUndefined();
  });

  it("preserves legacy creator filters and ordinary annotation substring matching", () => {
    expect(parseFilterParam("created_by:me")).toEqual({ created_by: "me" });
    expect(
      JSON.parse(
        filtersToFilterQuery({
          annotations: [{ key: SOURCE_PIPELINE_ID_ANNOTATION, value: "47a" }],
        })!,
      ),
    ).toEqual({
      and: [
        {
          value_contains: {
            key: SOURCE_PIPELINE_ID_ANNOTATION,
            value_substring: "47a",
          },
        },
      ],
    });
  });
});
