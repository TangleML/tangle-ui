import type { FileMetaData } from "hyparquet";
import { describe, expect, it } from "vitest";

import { buildSchemaJson, countColumns } from "./utils";

const metadata = (schema: unknown[], numRows: bigint): FileMetaData =>
  ({ schema, num_rows: numRows }) as unknown as FileMetaData;

describe("countColumns", () => {
  it("uses the root's num_children when present", () => {
    const meta = metadata(
      [
        { name: "root", num_children: 2 },
        { name: "a", type: "INT64" },
        { name: "b", type: "BYTE_ARRAY" },
      ],
      0n,
    );
    expect(countColumns(meta)).toBe(2);
  });

  it("falls back to the leaf (typed) element count", () => {
    const meta = metadata(
      [
        { name: "a", type: "INT64" },
        { name: "b", type: "BYTE_ARRAY" },
      ],
      0n,
    );
    expect(countColumns(meta)).toBe(2);
  });
});

describe("buildSchemaJson", () => {
  it("produces a clean, JSON-serializable column schema and sanitizes bigints", () => {
    const meta = metadata(
      [
        { name: "root", num_children: 2 },
        { name: "id", type: "INT64", repetition_type: "REQUIRED" },
        {
          name: "label",
          type: "BYTE_ARRAY",
          repetition_type: "OPTIONAL",
          logical_type: { type: "STRING" },
        },
      ],
      // Larger than Number.MAX_SAFE_INTEGER is unrealistic for a preview;
      // a plain large count exercises the bigint → number sanitization.
      42n,
    );

    const json = buildSchemaJson(meta);

    expect(json).toEqual({
      num_rows: 42,
      num_columns: 2,
      columns: [
        {
          name: "id",
          type: "INT64",
          repetition_type: "REQUIRED",
          nullable: false,
        },
        {
          name: "label",
          type: "STRING",
          logical_type: { type: "STRING" },
          repetition_type: "OPTIONAL",
          nullable: true,
        },
      ],
    });

    // Must round-trip through JSON without throwing on bigint.
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});
