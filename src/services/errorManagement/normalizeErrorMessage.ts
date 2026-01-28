// Message length constraints
const MAX_MESSAGE_LENGTH = 200;
const MAX_MESSAGE_TRUNCATED_LENGTH = 197;
const ELLIPSIS = "...";

// HTTP status code detection
const HTTP_LOOKBACK_LENGTH = 10;

/**
 * Normalization pattern configuration.
 * Each pattern extracts dynamic values and replaces them with placeholders.
 *
 * @param match - The full matched string
 * @param ...groups - Capture groups from the regex
 * @param offset - The offset of the match in the string
 * @param fullString - The full string being matched against
 * @param placeholder - The placeholder to use for this match
 * @returns Object with extracted value and replacement string, or null to skip extraction
 */
type NormalizationReplacer = (
  match: string,
  ...args: any[]
) => { value: string; replacement: string } | null;

interface NormalizationPattern {
  name: string;
  pattern: RegExp;
  replacer: NormalizationReplacer;
}

const NORMALIZATION_PATTERNS: NormalizationPattern[] = [
  {
    name: "uuid",
    pattern:
      /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$|\)|\s)/gi,
    replacer: (_match, uuid, after, _offset, _fullString, placeholder) => ({
      value: uuid,
      replacement: `/${placeholder}${after}`,
    }),
  },
  {
    name: "numericPathId",
    pattern: /\/(\d+)(\/|$|\)|\s)/g,
    replacer: (_match, num, after, _offset, _fullString, placeholder) => ({
      value: num,
      replacement: `/${placeholder}${after}`,
    }),
  },
  {
    name: "alphanumericPathId",
    pattern:
      /\/([a-zA-Z0-9]*\d[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{6,}|[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*\d[a-zA-Z0-9]{6,})(\/|$|\)|\s)/g,
    replacer: (_match, id, after, _offset, _fullString, placeholder) => ({
      value: id,
      replacement: `/${placeholder}${after}`,
    }),
  },
  {
    name: "queryParamId",
    pattern: /([?&][a-zA-Z_]+)=([0-9a-zA-Z-]{6,})/g,
    replacer: (_match, key, value, _offset, _fullString, placeholder) => {
      // Only extract if value contains digits or is hexadecimal
      if (/\d/.test(value) || /^[a-f0-9]+$/i.test(value)) {
        return {
          value,
          replacement: `${key}=${placeholder}`,
        };
      }
      return null; // Skip this match
    },
  },
  {
    name: "hashOrDigest",
    // Match common hash lengths: MD5 (32), SHA-1 (40), SHA-256 (64)
    // More specific than 16+ to avoid false positives with sequential numbers
    pattern: /\b([a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})\b/gi,
    replacer: (_match, hash, _offset, _fullString, placeholder) => ({
      value: hash,
      replacement: placeholder,
    }),
  },
  {
    name: "doubleQuotedString",
    pattern: /"([^"]+)"/g,
    replacer: (_match, content, _offset, _fullString, placeholder) => ({
      value: content,
      replacement: placeholder,
    }),
  },
  {
    name: "singleQuotedString",
    pattern: /'([^']+)'/g,
    replacer: (_match, content, _offset, _fullString, placeholder) => ({
      value: content,
      replacement: placeholder,
    }),
  },
  {
    name: "largeNumber",
    pattern: /\b\d{3,}\b/g,
    replacer: (match, offset, fullString, placeholder) => {
      const beforeMatch = fullString.substring(
        Math.max(0, offset - HTTP_LOOKBACK_LENGTH),
        offset,
      );
      // Preserve HTTP status codes (handle multiple spaces)
      if (/HTTP\s+$/.test(beforeMatch)) {
        return null; // Skip this match
      }
      return {
        value: match,
        replacement: placeholder,
      };
    },
  },
];

const CLEANUP_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\s+/g, replacement: " " },
  { pattern: /\(\s*\)/g, replacement: "" },
];

/**
 * Extract dynamic values from error message and replace with numbered placeholders.
 * Returns both the normalized message and a metadata object with extracted values.
 *
 * This normalization helps group similar errors together (e.g., errors with different
 * IDs, UUIDs, or dynamic values that are otherwise the same error).
 */
export function normalizeErrorMessage(message: string): {
  normalizedMessage: string;
  extractedValues: Record<string, string>;
} {
  const extractedValues: Record<string, string> = {};
  let extractedValueIndex = 1;
  let normalized = message;

  // Apply all normalization patterns
  for (const { pattern, replacer } of NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(pattern, (...args) => {
      const placeholder = `{var${extractedValueIndex}}`;
      // Call the replacer with all match args plus the placeholder
      const result = replacer(...args, placeholder);

      // If replacer returns null, skip this match
      if (result === null) {
        return args[0]; // Return the original match
      }

      // Extract the value and use the replacement
      extractedValues[placeholder] = result.value;
      extractedValueIndex++;
      return result.replacement;
    });
  }

  // Apply cleanup patterns (these don't extract values)
  for (const { pattern, replacement } of CLEANUP_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized.trim();

  // Limit length
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    normalized =
      normalized.substring(0, MAX_MESSAGE_TRUNCATED_LENGTH) + ELLIPSIS;
  }

  return { normalizedMessage: normalized, extractedValues };
}
