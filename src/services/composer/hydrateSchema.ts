import {
  type BlockDescriptor,
  type BlockHydrationReplacements,
  BlockType,
  type BlockValidationResult,
  type ComposerSchema,
  type SchemaValidationResult,
} from "@/types/composerSchema";

export function isComposerSchema(raw: unknown): raw is ComposerSchema {
  if (raw === null || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return "metadata" in obj && "sections" in obj && Array.isArray(obj.sections);
}

/**
 * Validates a raw JSON import as a `ComposerSchema`.
 *
 * TypeScript infers literal types from JSON imports, which don't align with
 * the discriminated union in `ComposerSchema` (e.g., `blockType` is inferred
 * as `string` rather than `BlockType.TextBlock`). This function uses a type
 * guard + `validateSchema()` so consumers never need `as unknown as`.
 */
export function loadSchema(raw: unknown): ComposerSchema {
  if (!isComposerSchema(raw)) {
    throw new Error(
      "Invalid ComposerSchema: must have 'metadata' object and 'sections' array",
    );
  }
  validateSchema(raw);
  return raw;
}

const PLACEHOLDER_REGEX = /\{(\w+)\}/g;

/**
 * Scans a value tree for `{placeholder}` tokens. Returns a set of all
 * placeholder names found (without the braces).
 *
 * Flattens the tree via JSON.stringify and scans the resulting string
 * in a single pass — avoids recursive traversal.
 */
function collectPlaceholders(value: unknown): Set<string> {
  const tokens = new Set<string>();
  const str = JSON.stringify(value);
  if (!str) return tokens;

  let match: RegExpExecArray | null;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(str)) !== null) {
    tokens.add(match[1]);
  }
  return tokens;
}

const VALID_BLOCK_TYPES = new Set<BlockType>(Object.values(BlockType));

/**
 * Static validation of a ComposerSchema. Checks schema structure
 * independently of runtime data — call once at config load time.
 *
 * Issues are surfaced as console warnings rather than exceptions so the
 * overlay still renders with unresolved placeholders visible, making it
 * easier to troubleshoot directly in the UI.
 *
 * Checks (each produces a warning, does not throw):
 * - Duplicate section IDs
 * - Duplicate block IDs across all sections
 * - Invalid blockType (not in BlockType enum)
 * - {placeholder} tokens in properties not declared in block's replacements
 * - Required replacements declared but not used as {placeholder} in properties
 */
export function validateSchema(schema: ComposerSchema): SchemaValidationResult {
  const warnings: string[] = [];
  const seenSectionIds = new Set<string>();
  const seenBlockIds = new Set<string>();

  for (const section of schema.sections) {
    if (seenSectionIds.has(section.id)) {
      warnings.push(
        `Duplicate section ID: "${section.id}". May cause unexpected React re-render behavior.`,
      );
    }
    seenSectionIds.add(section.id);

    for (const block of section.blocks) {
      if (seenBlockIds.has(block.id)) {
        warnings.push(
          `Duplicate block ID: "${block.id}". Hydration replacements may be applied to the wrong block.`,
        );
      }
      seenBlockIds.add(block.id);

      if (!VALID_BLOCK_TYPES.has(block.blockType)) {
        warnings.push(
          `Block "${block.id}": invalid blockType "${block.blockType}" (valid: ${[...VALID_BLOCK_TYPES].join(", ")}). This block will not be rendered.`,
        );
      }

      if (!block.replacements) continue;

      const declaredKeys = new Set(Object.keys(block.replacements));
      const usedTokens = collectPlaceholders(block.properties);

      for (const token of usedTokens) {
        if (!declaredKeys.has(token)) {
          warnings.push(
            `Block "${block.id}": placeholder {${token}} used in properties but not declared in replacements`,
          );
        }
      }

      for (const key of declaredKeys) {
        if (block.replacements[key].required && !usedTokens.has(key)) {
          warnings.push(
            `Block "${block.id}": required replacement "${key}" declared but not used as {${key}} in properties`,
          );
        }
      }
    }
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`[validateSchema] ${warning}`);
    }
  }

  return { ok: warnings.length === 0, warnings };
}

/**
 * Validates a single block's hydration values at runtime.
 * Called per-block during hydrateSchema() — separate from static validateSchema().
 *
 * Performs:
 * - Merges provided hydration values with declared defaults for missing non-required keys
 * - Reports missing required replacements (no value provided and no default)
 * - Passes through extra hydration keys not declared in replacements (no-op, ignored)
 */
export function validateBlock(
  block: BlockDescriptor,
  hydration: BlockHydrationReplacements | undefined,
): BlockValidationResult {
  const declared = block.replacements ?? {};
  const provided = hydration ?? {};
  const merged: BlockHydrationReplacements = { ...provided };

  const missing: string[] = [];

  for (const [key, descriptor] of Object.entries(declared)) {
    if (key in merged) continue;

    if (descriptor.default !== undefined) {
      merged[key] = descriptor.default;
      continue;
    }

    if (descriptor.required) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return { ok: false, blockId: block.id, missing };
  }

  return { ok: true, values: merged };
}

/**
 * Deep-substitutes `{placeholder}` tokens in a value tree.
 *
 * - If the entire value is a single `{token}`, replaces with the typed value
 *   directly (preserving boolean/number type).
 * - If the value is a string with embedded tokens, replaces inline (result is string).
 * - Recursively processes objects and arrays.
 */
export function substitutePlaceholders(
  value: unknown,
  values: BlockHydrationReplacements,
): unknown {
  if (typeof value === "string") {
    const singleMatch = /^\{(\w+)\}$/.exec(value);
    if (singleMatch && singleMatch[1] in values) {
      return values[singleMatch[1]];
    }
    return value.replace(/\{(\w+)\}/g, (fullMatch, key: string) =>
      key in values ? String(values[key]) : fullMatch,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => substitutePlaceholders(item, values));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substitutePlaceholders(v, values);
    }
    return result;
  }

  return value;
}

/**
 * Hydrates a ComposerSchema by validating and substituting placeholders
 * in each block's properties.
 *
 * @param schema - The static ComposerSchema (from JSON config)
 * @param allReplacements - Map of block ID -> resolved replacement values
 * @returns A new ComposerSchema with placeholders substituted
 */
export function hydrateSchema(
  schema: ComposerSchema,
  allReplacements: Record<string, BlockHydrationReplacements>,
): ComposerSchema {
  return {
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        if (!block.replacements) return block;

        const hydration = allReplacements[block.id];
        const validation = validateBlock(block, hydration);

        if (!validation.ok) {
          console.warn(`Block "${block.id}" validation failed:`, {
            missing: validation.missing,
          });
        }

        const resolvedValues = validation.ok
          ? validation.values
          : { ...(hydration ?? {}) };

        // Cast required: substitutePlaceholders returns `unknown` because it
        // transforms property types at runtime (e.g., string "{isRunning}" → boolean false).
        return {
          ...block,
          properties: substitutePlaceholders(block.properties, resolvedValues),
        } as BlockDescriptor;
      }),
    })),
  };
}

function filterByDisplayFor(
  schema: ComposerSchema,
  displayFor: string,
): ComposerSchema {
  return {
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      blocks: section.blocks.filter(
        (b) => !b.displayFor || b.displayFor.includes(displayFor),
      ),
    })),
  };
}

/**
 * Filters blocks by `displayFor` whitelist, then hydrates surviving blocks.
 *
 * @param schema - The static ComposerSchema (from JSON config)
 * @param allReplacements - Map of block ID -> resolved replacement values
 * @param displayFor - Execution type to filter by (e.g., "pod", "job").
 *   If null/undefined, no filtering is applied and all blocks are rendered.
 * @returns A new ComposerSchema with non-matching blocks removed and placeholders substituted
 */
export function filterAndHydrateSchema(
  schema: ComposerSchema,
  allReplacements: Record<string, BlockHydrationReplacements>,
  displayFor?: string | null,
): ComposerSchema {
  const filtered =
    displayFor == null ? schema : filterByDisplayFor(schema, displayFor);

  return hydrateSchema(filtered, allReplacements);
}
