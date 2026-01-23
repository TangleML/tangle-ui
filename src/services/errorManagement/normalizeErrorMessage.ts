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
  let counter = 1;

  let normalized = message;

  // Extract UUIDs
  normalized = normalized.replace(
    /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$|\)|\s)/gi,
    (_match, uuid, after) => {
      const placeholder = `{var${counter}}`;
      extractedValues[placeholder] = uuid;
      counter++;
      return `/${placeholder}${after}`;
    },
  );

  // Extract pure numeric IDs in paths
  normalized = normalized.replace(
    /\/(\d+)(\/|$|\)|\s)/g,
    (_match, num, after) => {
      const placeholder = `{var${counter}}`;
      extractedValues[placeholder] = num;
      counter++;
      return `/${placeholder}${after}`;
    },
  );

  // Extract alphanumeric IDs (long ones that have both letters and numbers)
  normalized = normalized.replace(
    /\/([a-zA-Z0-9]*\d[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{6,}|[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*\d[a-zA-Z0-9]{6,})(\/|$|\)|\s)/g,
    (_match, id, after) => {
      const placeholder = `{var${counter}}`;
      extractedValues[placeholder] = id;
      counter++;
      return `/${placeholder}${after}`;
    },
  );

  // Extract query param IDs
  normalized = normalized.replace(
    /([?&][a-zA-Z_]+)=([0-9a-zA-Z-]{6,})/g,
    (_match, key, value) => {
      if (/\d/.test(value) || /^[a-f0-9]+$/i.test(value)) {
        const placeholder = `{var${counter}}`;
        extractedValues[placeholder] = value;
        counter++;
        return `${key}=${placeholder}`;
      }
      return _match;
    },
  );

  // Extract hash/digest values
  normalized = normalized.replace(/\b([a-f0-9]{16,})\b/gi, (_match, hash) => {
    const placeholder = `{var${counter}}`;
    extractedValues[placeholder] = hash;
    counter++;
    return placeholder;
  });

  // Extract quoted strings
  normalized = normalized.replace(/"([^"]+)"/g, (_match, content) => {
    const placeholder = `{var${counter}}`;
    extractedValues[placeholder] = content;
    counter++;
    return placeholder;
  });

  normalized = normalized.replace(/'([^']+)'/g, (_match, content) => {
    const placeholder = `{var${counter}}`;
    extractedValues[placeholder] = content;
    counter++;
    return placeholder;
  });

  // Extract standalone large numbers, but preserve HTTP status codes
  normalized = normalized.replace(
    /\b\d{3,}\b/g,
    (_match, offset, fullString) => {
      const beforeMatch = fullString.substring(
        Math.max(0, offset - 5),
        offset,
      );
      if (beforeMatch.endsWith("HTTP ")) {
        return _match; // Keep HTTP status codes
      }
      const placeholder = `{var${counter}}`;
      extractedValues[placeholder] = _match;
      counter++;
      return placeholder;
    },
  );

  // Clean up multiple spaces and empty parentheses
  normalized = normalized
    .replace(/\s+/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();

  // Limit length
  if (normalized.length > 200) {
    normalized = normalized.substring(0, 197) + "...";
  }

  return { normalizedMessage: normalized, extractedValues };
}
