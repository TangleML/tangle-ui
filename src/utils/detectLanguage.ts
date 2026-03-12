export const LANGUAGE_OPTIONS = [
  { value: "plaintext", label: "Plain Text" },
  { value: "yaml", label: "YAML" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
] as const;

type LanguageOption = (typeof LANGUAGE_OPTIONS)[number]["value"];

export function isLanguageOption(value: string): value is LanguageOption {
  return LANGUAGE_OPTIONS.some((opt) => opt.value === value);
}

/**
 * Heuristically detects the language of a string from the supported Monaco
 * language set: json, sql, python, javascript, yaml, plaintext.
 *
 * Detection is ordered from most-certain to least-certain.
 */
export function detectLanguage(value: string): LanguageOption {
  // todo: figure out why we may receive a non-string value
  const trimmed = String(value).trim();

  if (!trimmed) return "plaintext";

  // JSON — most definitive: valid parse + structural start character
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // not valid json, fall through
    }
  }

  // SQL — distinctive opening keywords
  if (
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|TRUNCATE|MERGE)\b/im.test(
      trimmed,
    )
  ) {
    return "sql";
  }

  // Python — function/class definitions, module imports, decorators, docstrings
  if (
    /^(def |async def |class \w+\s*[:(])/m.test(trimmed) ||
    /^from\s+\S+\s+import\s/m.test(trimmed) ||
    /^import\s+\w[\w., ]*$/m.test(trimmed) ||
    /^@\w+/m.test(trimmed) ||
    /^if\s+__name__\s*==\s*["']__main__["']/m.test(trimmed)
  ) {
    return "python";
  }

  // JavaScript — const/let/var declarations, arrow functions, CommonJS/ESM imports
  if (
    /^(const|let|var)\s+\w/m.test(trimmed) ||
    /^(export\s+(default\s+)?|import\s+.*\s+from\s+['"])/m.test(trimmed) ||
    /^function\s+\w/m.test(trimmed) ||
    /\brequire\s*\(/.test(trimmed) ||
    /=>/.test(trimmed)
  ) {
    return "javascript";
  }

  // YAML — document separator, key: value pairs, or list items
  if (
    /^---/.test(trimmed) ||
    /^\w[\w\s-]*:\s/m.test(trimmed) ||
    /^- /m.test(trimmed)
  ) {
    return "yaml";
  }

  return "plaintext";
}
