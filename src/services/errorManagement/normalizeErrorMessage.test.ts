import { describe, expect, it } from "vitest";

import { normalizeErrorMessage } from "./normalizeErrorMessage";

describe("normalizeErrorMessage", () => {
  it("should extract UUIDs from error messages", () => {
    const message =
      "HTTP 404 Not Found: Resource not found (URL: http://localhost:8000/api/executions/019b3428-a0f0-d259-b764-ae0efbf37a64/status)";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "HTTP 404 Not Found: Resource not found (URL: http://localhost:{var2}/api/executions/{var1}/status)",
    );
    expect(result.extractedValues["{var1}"]).toBe(
      "019b3428-a0f0-d259-b764-ae0efbf37a64",
    );
    expect(result.extractedValues["{var2}"]).toBe("8000");
  });

  it("should extract numeric IDs from paths", () => {
    const message =
      "HTTP 500 Internal Server Error (URL: /api/runs/12345/tasks)";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "HTTP 500 Internal Server Error (URL: /api/runs/{var1}/tasks)",
    );
    expect(result.extractedValues["{var1}"]).toBe("12345");
  });

  it("should preserve HTTP status codes", () => {
    const message = "HTTP 502 Bad Gateway: Gateway timeout";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "HTTP 502 Bad Gateway: Gateway timeout",
    );
    expect(result.extractedValues).toEqual({});
  });

  it("should extract alphanumeric IDs", () => {
    const message = "Error fetching /api/resources/abc123def456/details";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "Error fetching /api/resources/{var1}/details",
    );
    expect(result.extractedValues["{var1}"]).toBe("abc123def456");
  });

  it("should extract query parameters with IDs", () => {
    const message = "Failed to load /api/data?id=abc123&status=pending";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "Failed to load /api/data?id={var1}&status=pending",
    );
    expect(result.extractedValues["{var1}"]).toBe("abc123");
  });

  it("should extract hash values (MD5, SHA-1, SHA-256)", () => {
    // Test MD5 hash (32 characters)
    const md5Message =
      "Validation failed for hash a1b2c3d4e5f67890123456789abcdef0";
    const md5Result = normalizeErrorMessage(md5Message);

    expect(md5Result.normalizedMessage).toBe(
      "Validation failed for hash {var1}",
    );
    expect(md5Result.extractedValues["{var1}"]).toBe(
      "a1b2c3d4e5f67890123456789abcdef0",
    );

    // Test SHA-1 hash (40 characters)
    const sha1Message =
      "Error: checksum mismatch abc123def4567890abcdef1234567890abcdef12";
    const sha1Result = normalizeErrorMessage(sha1Message);

    expect(sha1Result.normalizedMessage).toBe(
      "Error: checksum mismatch {var1}",
    );
    expect(sha1Result.extractedValues["{var1}"]).toBe(
      "abc123def4567890abcdef1234567890abcdef12",
    );

    // Test SHA-256 hash (64 characters)
    const sha256Message =
      "Failed to verify 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const sha256Result = normalizeErrorMessage(sha256Message);

    expect(sha256Result.normalizedMessage).toBe("Failed to verify {var1}");
    expect(sha256Result.extractedValues["{var1}"]).toBe(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
  });

  it("should extract quoted strings", () => {
    const message = 'Error: File "document.pdf" not found';
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe("Error: File {var1} not found");
    expect(result.extractedValues["{var1}"]).toBe("document.pdf");
  });

  it("should truncate long messages to 200 characters", () => {
    const longMessage = "Error: " + "a".repeat(300);
    const result = normalizeErrorMessage(longMessage);

    // After normalization, all 'a's get extracted as a quoted string placeholder
    // So the message becomes much shorter
    expect(result.normalizedMessage.length).toBeLessThanOrEqual(200);
  });

  it("should handle multiple dynamic values", () => {
    const message =
      "Failed to copy /files/abc123defghi/item to /files/xyz789ghijkl/backup";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "Failed to copy /files/{var1}/item to /files/{var2}/backup",
    );
    expect(result.extractedValues["{var1}"]).toBe("abc123defghi");
    expect(result.extractedValues["{var2}"]).toBe("xyz789ghijkl");
  });

  it("should clean up multiple spaces and empty parentheses", () => {
    const message = "Error:   Multiple   spaces   and  ()  empty  parens  ()";
    const result = normalizeErrorMessage(message);

    // The function cleans up multiple spaces to single spaces and removes empty parens
    expect(result.normalizedMessage).toContain("Error:");
    expect(result.normalizedMessage).toContain("Multiple");
    expect(result.normalizedMessage).not.toContain("()");
    expect(result.normalizedMessage.trim()).toBe(result.normalizedMessage);
  });

  it("should NOT extract short hex strings that are not real hashes", () => {
    // 26 characters - too short to be a real hash, should not be extracted
    const message = "Error with value a1b2c3d4e5f6789012345678 in system";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "Error with value a1b2c3d4e5f6789012345678 in system",
    );
    expect(result.extractedValues).toEqual({});
  });

  it("should preserve HTTP status codes with multiple spaces", () => {
    const message = "HTTP  502 Bad Gateway: Gateway timeout";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toContain("HTTP 502");
    expect(result.normalizedMessage).toContain("Gateway timeout");
    // The 502 should NOT be extracted as a variable
    expect(result.normalizedMessage).not.toContain("{var");
  });
});
