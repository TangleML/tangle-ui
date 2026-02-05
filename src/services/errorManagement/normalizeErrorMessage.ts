const MAX_MESSAGE_LENGTH = 200;
const MAX_MESSAGE_TRUNCATED_LENGTH = 197;
const ELLIPSIS = "...";
const HTTP_LOOKBACK_LENGTH = 10;

// Regex patterns for normalizing error messages
const UUID_PATH_SEGMENT_PATTERN =
  /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$|\)|\s)/gi;

const NUMERIC_PATH_SEGMENT_PATTERN = /\/(\d+)(\/|$|\)|\s)/g;

const ALPHANUMERIC_PATH_ID_MIN_6_CHARS_WITH_LETTERS_AND_DIGITS_PATTERN =
  /\/([a-zA-Z0-9]*\d[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{6,}|[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*\d[a-zA-Z0-9]{6,})(\/|$|\)|\s)/g;

const QUERY_PARAM_VALUE_WITH_DIGITS_OR_HEX_PATTERN =
  /([?&][a-zA-Z_]+)=([0-9a-zA-Z-]{6,})/g;

const CRYPTOGRAPHIC_HASH_MD5_SHA1_SHA256_PATTERN =
  /\b([a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})\b/gi;

const CONTENT_IN_DOUBLE_QUOTES_PATTERN = /"([^"]+)"/g;

const CONTENT_IN_SINGLE_QUOTES_PATTERN = /'([^']+)'/g;

const THREE_OR_MORE_DIGIT_NUMBER_PATTERN = /\b\d{3,}\b/g;

const HTTP_STATUS_CODE_PREFIX_PATTERN = /HTTP\s+$/;

const HAS_DIGIT_PATTERN = /\d/;

const IS_ALL_HEXADECIMAL_PATTERN = /^[a-f0-9]+$/i;

type NormalizationResult = { value: string; replacement: string } | null;

// Replacer for patterns with 2 capture groups (e.g., /users/123/profile → captures "123" and "/")
type TwoGroupReplacer = (
  match: string,
  group1: string,
  group2: string,
  offset: number,
  fullString: string,
  placeholder: string,
) => NormalizationResult;

// Replacer for patterns with 1 capture group (e.g., "error message" → captures "error message")
type OneGroupReplacer = (
  match: string,
  group1: string,
  offset: number,
  fullString: string,
  placeholder: string,
) => NormalizationResult;

// Replacer for patterns with no capture groups (e.g., matches 12345 as a whole)
type NoGroupReplacer = (
  match: string,
  offset: number,
  fullString: string,
  placeholder: string,
) => NormalizationResult;

interface NormalizationPattern<
  T extends TwoGroupReplacer | OneGroupReplacer | NoGroupReplacer,
> {
  name: string;
  pattern: RegExp;
  replacer: T;
}

const NORMALIZATION_PATTERNS: Array<
  | NormalizationPattern<TwoGroupReplacer>
  | NormalizationPattern<OneGroupReplacer>
  | NormalizationPattern<NoGroupReplacer>
> = [
  {
    name: "uuid",
    pattern: UUID_PATH_SEGMENT_PATTERN,
    replacer: (_match, uuid, after, _offset, _fullString, placeholder) => ({
      value: uuid,
      replacement: `/${placeholder}${after}`,
    }),
  } satisfies NormalizationPattern<TwoGroupReplacer>,
  {
    name: "numericPathId",
    pattern: NUMERIC_PATH_SEGMENT_PATTERN,
    replacer: (_match, num, after, _offset, _fullString, placeholder) => ({
      value: num,
      replacement: `/${placeholder}${after}`,
    }),
  } satisfies NormalizationPattern<TwoGroupReplacer>,
  {
    name: "alphanumericPathId",
    pattern: ALPHANUMERIC_PATH_ID_MIN_6_CHARS_WITH_LETTERS_AND_DIGITS_PATTERN,
    replacer: (_match, id, after, _offset, _fullString, placeholder) => ({
      value: id,
      replacement: `/${placeholder}${after}`,
    }),
  } satisfies NormalizationPattern<TwoGroupReplacer>,
  {
    name: "queryParamId",
    pattern: QUERY_PARAM_VALUE_WITH_DIGITS_OR_HEX_PATTERN,
    replacer: (_match, key, value, _offset, _fullString, placeholder) => {
      if (
        HAS_DIGIT_PATTERN.test(value) ||
        IS_ALL_HEXADECIMAL_PATTERN.test(value)
      ) {
        return {
          value,
          replacement: `${key}=${placeholder}`,
        };
      }
      return null;
    },
  } satisfies NormalizationPattern<TwoGroupReplacer>,
  {
    name: "hashOrDigest",
    pattern: CRYPTOGRAPHIC_HASH_MD5_SHA1_SHA256_PATTERN,
    replacer: (_match, hash, _offset, _fullString, placeholder) => ({
      value: hash,
      replacement: placeholder,
    }),
  } satisfies NormalizationPattern<OneGroupReplacer>,
  {
    name: "doubleQuotedString",
    pattern: CONTENT_IN_DOUBLE_QUOTES_PATTERN,
    replacer: (_match, content, _offset, _fullString, placeholder) => ({
      value: content,
      replacement: placeholder,
    }),
  } satisfies NormalizationPattern<OneGroupReplacer>,
  {
    name: "singleQuotedString",
    pattern: CONTENT_IN_SINGLE_QUOTES_PATTERN,
    replacer: (_match, content, _offset, _fullString, placeholder) => ({
      value: content,
      replacement: placeholder,
    }),
  } satisfies NormalizationPattern<OneGroupReplacer>,
  {
    name: "largeNumber",
    pattern: THREE_OR_MORE_DIGIT_NUMBER_PATTERN,
    replacer: (match, offset, fullString, placeholder) => {
      const beforeMatch = fullString.substring(
        Math.max(0, offset - HTTP_LOOKBACK_LENGTH),
        offset,
      );
      // Preserve HTTP status codes (handle multiple spaces)
      if (HTTP_STATUS_CODE_PREFIX_PATTERN.test(beforeMatch)) {
        return null;
      }
      return {
        value: match,
        replacement: placeholder,
      };
    },
  } satisfies NormalizationPattern<NoGroupReplacer>,
];

const CLEANUP_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\s+/g, replacement: " " },
  { pattern: /\(\s*\)/g, replacement: "" },
];

export function normalizeErrorMessage(message: string): {
  normalizedMessage: string;
  extractedValues: Record<string, string>;
} {
  const extractedValues: Record<string, string> = {};
  let extractedValueIndex = 1;
  let normalized = message;

  for (const { pattern, replacer } of NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(
      pattern,
      (match: string, ...args: (string | number)[]) => {
        const placeholder = `{var${extractedValueIndex}}`;
        // Call the replacer with the match and remaining args + placeholder
        const result = (replacer as (...args: any[]) => NormalizationResult)(
          match,
          ...args,
          placeholder,
        );

        if (result === null) {
          return match;
        }

        extractedValues[placeholder] = result.value;
        extractedValueIndex++;
        return result.replacement;
      },
    );
  }

  for (const { pattern, replacement } of CLEANUP_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized.trim();

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    normalized =
      normalized.substring(0, MAX_MESSAGE_TRUNCATED_LENGTH) + ELLIPSIS;
  }

  return { normalizedMessage: normalized, extractedValues };
}
