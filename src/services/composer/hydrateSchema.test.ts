import { describe, expect, it, vi } from "vitest";

import {
  BlockType,
  type ComposerSchema,
  QueryParamType,
  ReplacementType,
} from "@/types/composerSchema";

import {
  filterAndHydrateSchema,
  hydrateSchema,
  isComposerSchema,
  loadSchema,
  substitutePlaceholders,
  validateBlock,
  validateSchema,
} from "./hydrateSchema";

describe("loadSchema", () => {
  it("returns a typed ComposerSchema from raw JSON", () => {
    const raw = {
      metadata: { retentionDays: 30 },
      sections: [
        {
          id: "s1",
          title: "Section",
          blocks: [
            {
              id: "b1",
              blockType: "TextBlock",
              properties: { text: "Hello" },
            },
          ],
        },
      ],
    };

    const schema = loadSchema(raw);
    expect(schema.metadata).toEqual({ retentionDays: 30 });
    expect(schema.sections).toHaveLength(1);
    expect(schema.sections[0].blocks[0].id).toBe("b1");
  });

  it("returns a valid schema for empty sections", () => {
    const schema = loadSchema({ metadata: {}, sections: [] });
    expect(schema.sections).toHaveLength(0);
  });
});

describe("validateSchema", () => {
  const validSchema: ComposerSchema = {
    metadata: {},
    sections: [
      {
        id: "section1",
        title: "Test",
        blocks: [
          {
            id: "block1",
            blockType: BlockType.TextBlock,
            properties: { text: "Hello {name}", tone: "default" },
            replacements: {
              name: {
                type: ReplacementType.String,
                required: true,
              },
            },
          },
        ],
      },
    ],
  };

  it("returns ok for a valid schema", () => {
    const result = validateSchema(validSchema);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("warns on duplicate section IDs", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "dup-section",
          title: "First",
          blocks: [
            {
              id: "b1",
              blockType: BlockType.TextBlock,
              properties: { text: "a" },
            },
          ],
        },
        {
          id: "dup-section",
          title: "Second",
          blocks: [
            {
              id: "b2",
              blockType: BlockType.TextBlock,
              properties: { text: "b" },
            },
          ],
        },
      ],
    };
    const result = validateSchema(schema);
    expect(result.ok).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.stringContaining(
        'Duplicate section ID: "dup-section". May cause unexpected React re-render behavior.',
      ),
    );
  });

  it("warns on duplicate block IDs", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "S1",
          blocks: [
            {
              id: "dup",
              blockType: BlockType.TextBlock,
              properties: { text: "a" },
            },
          ],
        },
        {
          id: "s2",
          title: "S2",
          blocks: [
            {
              id: "dup",
              blockType: BlockType.TextBlock,
              properties: { text: "b" },
            },
          ],
        },
      ],
    };
    const result = validateSchema(schema);
    expect(result.ok).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.stringContaining(
        'Duplicate block ID: "dup". Hydration replacements may be applied to the wrong block.',
      ),
    );
  });

  it("warns on invalid blockType", () => {
    const schema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "S1",
          blocks: [
            {
              id: "bad",
              blockType: "UnknownBlock",
              properties: { text: "x" },
            },
          ],
        },
      ],
    } as unknown as ComposerSchema;
    const result = validateSchema(schema);
    expect(result.ok).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.stringContaining(
        'invalid blockType "UnknownBlock" (valid: TextBlock, LinkBlock). This block will not be rendered.',
      ),
    );
  });

  it("warns on undeclared placeholder in properties", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "S1",
          blocks: [
            {
              id: "b1",
              blockType: BlockType.TextBlock,
              properties: { text: "Hello {undeclared}" },
              replacements: {},
            },
          ],
        },
      ],
    };
    const result = validateSchema(schema);
    expect(result.ok).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.stringContaining(
        "placeholder {undeclared} used in properties but not declared in replacements",
      ),
    );
  });

  it("warns on required replacement not used in properties", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "S1",
          blocks: [
            {
              id: "b1",
              blockType: BlockType.TextBlock,
              properties: { text: "No placeholders here" },
              replacements: {
                unusedKey: {
                  type: ReplacementType.String,
                  required: true,
                },
              },
            },
          ],
        },
      ],
    };
    const result = validateSchema(schema);
    expect(result.ok).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.stringContaining(
        'required replacement "unusedKey" declared but not used as {unusedKey} in properties',
      ),
    );
  });

  it("passes for a realistic multi-block schema", () => {
    const realisticSchema: ComposerSchema = {
      metadata: { paddingMinutes: 5, retentionDays: 30 },
      sections: [
        {
          id: "logs",
          title: "Logs & Events",
          blocks: [
            {
              id: "retentionNotice",
              blockType: BlockType.TextBlock,
              properties: {
                text: "Logs have a {retentionDays}-day retention policy. Data expires on {expiryDate}.",
                tone: "warning",
              },
              replacements: {
                retentionDays: {
                  type: ReplacementType.Number,
                  required: true,
                },
                expiryDate: {
                  type: ReplacementType.String,
                  required: true,
                },
              },
            },
            {
              id: "podLogs",
              blockType: BlockType.LinkBlock,
              properties: {
                urlTemplate: "https://example.com/query",
                queryParams: {
                  q: {
                    type: QueryParamType.Json,
                    value: {
                      filter_group: {
                        filters: [
                          {
                            column: "kube_pod",
                            op: "contains",
                            value: "{podName}",
                          },
                        ],
                      },
                    },
                  },
                  r: {
                    type: QueryParamType.Json,
                    value: { from: "{startTime}", to: "{endTime}" },
                  },
                  category: {
                    type: QueryParamType.String,
                    value: "logging",
                  },
                },
              },
              replacements: {
                podName: {
                  type: ReplacementType.String,
                  required: true,
                },
                startTime: {
                  type: ReplacementType.String,
                  required: true,
                },
                endTime: {
                  type: ReplacementType.String,
                  required: true,
                },
              },
            },
            {
              id: "runningHint",
              blockType: BlockType.TextBlock,
              properties: {
                text: "Task is still running.",
                tone: "subdued",
                isVisible: "{isRunning}" as unknown as boolean,
              },
              replacements: {
                isRunning: {
                  type: ReplacementType.Boolean,
                  required: false,
                  default: false,
                },
              },
            },
          ],
        },
      ],
    };

    const result = validateSchema(realisticSchema);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});

describe("validateBlock", () => {
  it("passes when all required replacements are provided", () => {
    const result = validateBlock(
      {
        id: "test",
        blockType: BlockType.TextBlock,
        properties: { text: "Hello {name}" },
        replacements: {
          name: { type: ReplacementType.String, required: true },
        },
      },
      // "name" is present in hydrationReplacements to replace placeholder {name}
      { name: "World" },
    );

    expect(result).toEqual({ ok: true, values: { name: "World" } });
  });

  it("reports missing required replacements", () => {
    const result = validateBlock(
      {
        id: "test",
        blockType: BlockType.TextBlock,
        properties: { text: "Hello {name}" },
        replacements: {
          name: { type: ReplacementType.String, required: true },
        },
      },
      // No hydration replacements provided for required placeholder {name}
      {},
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("name");
    }
  });

  it("applies defaults for non-required replacements when missing", () => {
    const result = validateBlock(
      {
        id: "test",
        blockType: BlockType.TextBlock,
        properties: { text: "{greeting} {name}" },
        replacements: {
          greeting: {
            type: ReplacementType.String,
            required: false,
            default: "Hi",
          },
          name: { type: ReplacementType.String, required: true },
        },
      },
      // Only "name" provided; "greeting" is missing but has a default ("Hi")
      { name: "World" },
    );

    expect(result).toEqual({
      ok: true,
      values: { name: "World", greeting: "Hi" },
    });
  });

  it("passes for blocks with no replacements declared", () => {
    const result = validateBlock(
      {
        id: "static",
        blockType: BlockType.TextBlock,
        properties: { text: "No placeholders here" },
      },
      // No hydration replacements — block has no placeholders to replace
      undefined,
    );

    expect(result).toEqual({ ok: true, values: {} });
  });

  it("handles extra keys in hydration not declared in schema", () => {
    const result = validateBlock(
      {
        id: "test",
        blockType: BlockType.TextBlock,
        properties: { text: "Hello {name}" },
        replacements: {
          name: { type: ReplacementType.String, required: true },
        },
      },
      // "name" replaces {name}; "extra" is not declared in replacements but passed through
      { name: "World", extra: "ignored" },
    );

    expect(result).toEqual({
      ok: true,
      values: { name: "World", extra: "ignored" },
    });
  });
});

describe("substitutePlaceholders", () => {
  it("replaces embedded placeholders in strings", () => {
    const result = substitutePlaceholders("Hello {name}, welcome to {city}!", {
      name: "Alice",
      city: "Paris",
    });
    expect(result).toBe("Hello Alice, welcome to Paris!");
  });

  it("preserves typed values for full-value placeholders", () => {
    expect(substitutePlaceholders("{name}", { name: "Alice" })).toBe("Alice");
    expect(substitutePlaceholders("{isRunning}", { isRunning: false })).toBe(
      false,
    );
    expect(substitutePlaceholders("{count}", { count: 42 })).toBe(42);
    expect(substitutePlaceholders("{flag}", { flag: true })).toBe(true);
  });

  it("leaves unresolved placeholders as-is", () => {
    const result = substitutePlaceholders("Hello {name} from {unknown}", {
      name: "Alice",
    });
    expect(result).toBe("Hello Alice from {unknown}");
  });

  it("recursively substitutes in nested objects", () => {
    const result = substitutePlaceholders(
      {
        outer: {
          inner: { value: "{podName}" },
          list: ["{startTime}", "{endTime}"],
        },
      },
      { podName: "pod-abc", startTime: "09:00", endTime: "10:00" },
    );

    expect(result).toEqual({
      outer: {
        inner: { value: "pod-abc" },
        list: ["09:00", "10:00"],
      },
    });
  });

  it("handles deep-nested queryParams structure", () => {
    const input = {
      q: {
        type: QueryParamType.Json,
        value: {
          filter_group: {
            filters: [
              { column: "kube_pod", op: "contains", value: "{podName}" },
            ],
          },
        },
      },
      r: {
        type: QueryParamType.Json,
        value: { from: "{startTime}", to: "{endTime}" },
      },
    };

    const result = substitutePlaceholders(input, {
      podName: "worker-abc-123",
      startTime: "2026-03-01T09:55:00.000Z",
      endTime: "2026-03-01T11:05:00.000Z",
    });

    expect(result).toEqual({
      q: {
        type: QueryParamType.Json,
        value: {
          filter_group: {
            filters: [
              {
                column: "kube_pod",
                op: "contains",
                value: "worker-abc-123",
              },
            ],
          },
        },
      },
      r: {
        type: QueryParamType.Json,
        value: {
          from: "2026-03-01T09:55:00.000Z",
          to: "2026-03-01T11:05:00.000Z",
        },
      },
    });
  });

  it("returns non-string primitives unchanged", () => {
    expect(substitutePlaceholders(42, {})).toBe(42);
    expect(substitutePlaceholders(true, {})).toBe(true);
    expect(substitutePlaceholders(null, {})).toBe(null);
  });
});

describe("hydrateSchema", () => {
  const baseSchema: ComposerSchema = {
    metadata: { paddingMinutes: 5, retentionDays: 30 },
    sections: [
      {
        id: "observability",
        title: "Observability",
        blocks: [
          {
            id: "retentionNotice",
            blockType: BlockType.TextBlock,
            properties: {
              text: "Logs have a {retentionDays}-day retention policy. Metrics expire on {expiryDate}.",
              tone: "warning",
            },
            replacements: {
              retentionDays: { type: ReplacementType.Number, required: true },
              expiryDate: { type: ReplacementType.String, required: true },
            },
          },
          {
            id: "podLogs",
            blockType: BlockType.LinkBlock,
            properties: {
              urlTemplate: "https://example.com/query",
              queryParams: {
                r: {
                  type: QueryParamType.Json,
                  value: { from: "{startTime}", to: "{endTime}" },
                },
              },
            },
            replacements: {
              startTime: { type: ReplacementType.String, required: true },
              endTime: { type: ReplacementType.String, required: true },
            },
          },
          {
            id: "staticBlock",
            blockType: BlockType.TextBlock,
            properties: { text: "No replacements needed." },
          },
        ],
      },
    ],
  };

  it("hydrates all blocks with matching replacements", () => {
    const hydrated = hydrateSchema(baseSchema, {
      // "retentionNotice" replacements: {retentionDays} and {expiryDate}
      retentionNotice: { retentionDays: 30, expiryDate: "Mar 31, 2026" },
      // "podLogs" replacements: {startTime} and {endTime}
      podLogs: {
        startTime: "2026-03-01T09:55:00.000Z",
        endTime: "2026-03-01T11:05:00.000Z",
      },
      // "staticBlock" has no placeholders — no entry needed
    });

    const blocks = hydrated.sections[0].blocks;

    expect(
      (blocks[0] as { properties: { text: string } }).properties.text,
    ).toBe(
      "Logs have a 30-day retention policy. Metrics expire on Mar 31, 2026.",
    );

    const podLogsProps = blocks[1].properties as unknown as {
      queryParams: { r: { value: { from: string; to: string } } };
    };
    expect(podLogsProps.queryParams.r.value.from).toBe(
      "2026-03-01T09:55:00.000Z",
    );
    expect(podLogsProps.queryParams.r.value.to).toBe(
      "2026-03-01T11:05:00.000Z",
    );

    expect(
      (blocks[2] as { properties: { text: string } }).properties.text,
    ).toBe("No replacements needed.");
  });

  it("leaves unresolved placeholders as-is on validation failure", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const hydrated = hydrateSchema(baseSchema, {
      // No replacements for "retentionNotice" — {retentionDays} and {expiryDate} will remain as-is
      retentionNotice: {},
      // "podLogs" fully provided
      podLogs: {
        startTime: "2026-03-01T09:55:00.000Z",
        endTime: "2026-03-01T11:05:00.000Z",
      },
    });

    const text = (
      hydrated.sections[0].blocks[0] as { properties: { text: string } }
    ).properties.text;
    expect(text).toContain("{retentionDays}");
    expect(text).toContain("{expiryDate}");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("retentionNotice"),
      expect.objectContaining({ missing: ["retentionDays", "expiryDate"] }),
    );

    warnSpy.mockRestore();
  });

  it("returns schema unchanged when no blocks have replacements", () => {
    const staticSchema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "Static",
          blocks: [
            {
              id: "b1",
              blockType: BlockType.TextBlock,
              properties: { text: "Static content" },
            },
          ],
        },
      ],
    };

    // No blocks have placeholders — empty hydration map
    const hydrated = hydrateSchema(staticSchema, {});
    expect(hydrated.sections[0].blocks[0].properties).toEqual({
      text: "Static content",
    });
  });

  it("handles isVisible as a boolean full-value placeholder", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "Test",
          blocks: [
            {
              id: "runningHint",
              blockType: BlockType.TextBlock,
              properties: {
                text: "Still running.",
                isVisible: "{isRunning}" as unknown as boolean,
              },
              replacements: {
                isRunning: {
                  type: ReplacementType.Boolean,
                  required: false,
                  default: false,
                },
              },
            },
          ],
        },
      ],
    };

    const hydrated = hydrateSchema(schema, {
      // "isRunning" replaces full-value placeholder {isRunning} with boolean true
      runningHint: { isRunning: true },
    });

    expect(
      (hydrated.sections[0].blocks[0] as { properties: { isVisible: boolean } })
        .properties.isVisible,
    ).toBe(true);
  });
});

describe("isComposerSchema", () => {
  it("returns true for a valid schema shape", () => {
    expect(isComposerSchema({ metadata: {}, sections: [] })).toBe(true);
  });

  it("returns true when sections is a non-empty array", () => {
    expect(
      isComposerSchema({
        metadata: { retentionDays: 30 },
        sections: [{ id: "s1", title: "S", blocks: [] }],
      }),
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isComposerSchema(null)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isComposerSchema("not a schema")).toBe(false);
  });

  it("returns false when metadata is missing", () => {
    expect(isComposerSchema({ sections: [] })).toBe(false);
  });

  it("returns false when sections is missing", () => {
    expect(isComposerSchema({ metadata: {} })).toBe(false);
  });

  it("returns false when sections is not an array", () => {
    expect(isComposerSchema({ metadata: {}, sections: "not-array" })).toBe(
      false,
    );
  });
});

describe("filterAndHydrateSchema", () => {
  const schemaWithDisplayFor: ComposerSchema = {
    metadata: { retentionDays: 30 },
    sections: [
      {
        id: "logsAndEvents",
        title: "Logs & Events",
        blocks: [
          {
            id: "retentionNotice",
            blockType: BlockType.TextBlock,
            properties: { text: "{retentionDays}-day retention." },
            replacements: {
              retentionDays: { type: ReplacementType.Number, required: true },
            },
          },
          {
            id: "podLogs",
            blockType: BlockType.LinkBlock,
            displayFor: ["kubernetes_pod", "kubernetes_job"],
            properties: {
              urlTemplate: "https://example.com/logs?pod={podName}",
            },
            replacements: {
              podName: { type: ReplacementType.String, required: true },
            },
          },
          {
            id: "podEvents",
            blockType: BlockType.LinkBlock,
            displayFor: ["kubernetes_pod"],
            properties: {
              urlTemplate: "https://example.com/events?pod={podName}",
            },
            replacements: {
              podName: { type: ReplacementType.String, required: true },
            },
          },
          {
            id: "jobEvents",
            blockType: BlockType.LinkBlock,
            displayFor: ["kubernetes_job"],
            properties: {
              urlTemplate: "https://example.com/events?job={jobName}",
            },
            replacements: {
              jobName: { type: ReplacementType.String, required: true },
            },
          },
          {
            id: "runningHint",
            blockType: BlockType.TextBlock,
            properties: { text: "Still running." },
          },
        ],
      },
    ],
  };

  const allReplacements = {
    retentionNotice: { retentionDays: 30 },
    podLogs: { podName: "pod-abc" },
    podEvents: { podName: "pod-abc" },
    jobEvents: { jobName: "job-xyz" },
  };

  it("keeps pod-only and shared blocks when displayFor is 'kubernetes_pod'", () => {
    const result = filterAndHydrateSchema(
      schemaWithDisplayFor,
      allReplacements,
      "kubernetes_pod",
    );
    const blockIds = result.sections[0].blocks.map((b) => b.id);
    expect(blockIds).toContain("retentionNotice");
    expect(blockIds).toContain("podLogs");
    expect(blockIds).toContain("podEvents");
    expect(blockIds).toContain("runningHint");
    expect(blockIds).not.toContain("jobEvents");
  });

  it("keeps job-only and shared blocks when displayFor is 'kubernetes_job'", () => {
    const result = filterAndHydrateSchema(
      schemaWithDisplayFor,
      allReplacements,
      "kubernetes_job",
    );
    const blockIds = result.sections[0].blocks.map((b) => b.id);
    expect(blockIds).toContain("retentionNotice");
    expect(blockIds).toContain("podLogs");
    expect(blockIds).toContain("jobEvents");
    expect(blockIds).toContain("runningHint");
    expect(blockIds).not.toContain("podEvents");
  });

  it("keeps all blocks when displayFor is undefined", () => {
    const result = filterAndHydrateSchema(
      schemaWithDisplayFor,
      allReplacements,
      undefined,
    );
    const blockIds = result.sections[0].blocks.map((b) => b.id);
    expect(blockIds).toEqual([
      "retentionNotice",
      "podLogs",
      "podEvents",
      "jobEvents",
      "runningHint",
    ]);
  });

  it("keeps all blocks when displayFor is null", () => {
    const result = filterAndHydrateSchema(
      schemaWithDisplayFor,
      allReplacements,
      null,
    );
    const blockIds = result.sections[0].blocks.map((b) => b.id);
    expect(blockIds).toEqual([
      "retentionNotice",
      "podLogs",
      "podEvents",
      "jobEvents",
      "runningHint",
    ]);
  });

  it("filters out tagged blocks that don't match, keeps untagged blocks", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = filterAndHydrateSchema(
      schemaWithDisplayFor,
      allReplacements,
      "nonexistent",
    );

    const survivingBlockIds = result.sections[0].blocks.map((b) => b.id);
    expect(survivingBlockIds).toEqual(["retentionNotice", "runningHint"]);

    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("hydrates surviving blocks with placeholder substitution", () => {
    const result = filterAndHydrateSchema(
      schemaWithDisplayFor,
      allReplacements,
      "kubernetes_pod",
    );

    const retentionBlock = result.sections[0].blocks.find(
      (b) => b.id === "retentionNotice",
    );
    expect(
      (retentionBlock as { properties: { text: string } }).properties.text,
    ).toBe("30-day retention.");

    const podEventsBlock = result.sections[0].blocks.find(
      (b) => b.id === "podEvents",
    );
    expect(
      (podEventsBlock as { properties: { urlTemplate: string } }).properties
        .urlTemplate,
    ).toBe("https://example.com/events?pod=pod-abc");
  });

  it("does not mutate the original schema", () => {
    const originalBlockCount = schemaWithDisplayFor.sections[0].blocks.length;

    filterAndHydrateSchema(
      schemaWithDisplayFor,
      allReplacements,
      "kubernetes_pod",
    );

    expect(schemaWithDisplayFor.sections[0].blocks).toHaveLength(
      originalBlockCount,
    );
    expect(schemaWithDisplayFor.sections[0].blocks.map((b) => b.id)).toEqual([
      "retentionNotice",
      "podLogs",
      "podEvents",
      "jobEvents",
      "runningHint",
    ]);
  });
});
