import type { CompressionCodec, FileMetaData } from "hyparquet";
import { describe, expect, it } from "vitest";

import {
  assertDecodableCodecs,
  buildSchemaJson,
  countColumns,
  ParquetUnsupportedCodecError,
} from "./parquetUtils";

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
      // A bigint row count exercises hyparquet's toJson bigint sanitization.
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

describe("assertDecodableCodecs", () => {
  const withCodecs = (...rowGroupCodecs: CompressionCodec[][]): FileMetaData =>
    ({
      row_groups: rowGroupCodecs.map((codecs) => ({
        columns: codecs.map((codec) => ({ meta_data: { codec } })),
      })),
    }) as unknown as FileMetaData;

  it("rejects a codec that cannot be decoded, naming it", () => {
    const check = () => assertDecodableCodecs(withCodecs(["ZSTD"]));

    expect(check).toThrow(ParquetUnsupportedCodecError);
    expect(check).toThrow(
      "Unsupported compression codec: ZSTD. Only uncompressed and Snappy-compressed Parquet files can be previewed.",
    );
  });

  it("accepts uncompressed and Snappy-compressed columns", () => {
    expect(() =>
      assertDecodableCodecs(withCodecs(["UNCOMPRESSED", "SNAPPY"], ["SNAPPY"])),
    ).not.toThrow();
  });

  it("rejects a file where only some columns use an unsupported codec", () => {
    const check = () =>
      assertDecodableCodecs(withCodecs(["SNAPPY", "UNCOMPRESSED"], ["GZIP"]));

    expect(check).toThrow(ParquetUnsupportedCodecError);
    expect(check).toThrow("Unsupported compression codec: GZIP.");
  });
});
