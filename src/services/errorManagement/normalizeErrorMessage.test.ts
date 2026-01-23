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
    const message = "HTTP 500 Internal Server Error (URL: /api/runs/12345/tasks)";
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

  it("should extract hash values", () => {
    const message = "Validation failed for hash a1b2c3d4e5f6789012345678";
    const result = normalizeErrorMessage(message);

    expect(result.normalizedMessage).toBe(
      "Validation failed for hash {var1}",
    );
    expect(result.extractedValues["{var1}"]).toBe("a1b2c3d4e5f6789012345678");
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
});
