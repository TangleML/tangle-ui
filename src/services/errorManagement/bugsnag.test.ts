import { type Event } from "@bugsnag/js";
import { describe, expect, it, vi } from "vitest";

import { handleBugsnagError } from "./bugsnag";

// Mock window.location.pathname
const mockPathname = "/test/path";
Object.defineProperty(window, "location", {
  value: { pathname: mockPathname },
  writable: true,
});

// Helper to create a mock Bugsnag event
const createMockEvent = (errorClass: string, errorMessage: string): Event =>
  ({
    errors: [
      {
        errorClass,
        errorMessage,
        stacktrace: [],
        type: "nodejs",
      },
    ],
    groupingHash: undefined,
    addMetadata: vi.fn(),
  }) as unknown as Event;

describe("handleBugsnagError", () => {
  it("should normalize generic Error instances", () => {
    const event = createMockEvent(
      "Error",
      "HTTP 404 Not Found: /api/executions/019b3428-a0f0-d259-b764-ae0efbf37a64/status",
    ) as Event;

    handleBugsnagError(event, {});

    // Should set grouping hash to normalized message
    expect(event.groupingHash).toBe(
      "HTTP 404 Not Found: /api/executions/{var1}/status",
    );

    // Should update errorClass to normalized message
    expect(event.errors[0].errorClass).toBe(
      "HTTP 404 Not Found: /api/executions/{var1}/status",
    );

    // Should add context metadata
    expect(event.addMetadata).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });

    // Should add extracted values metadata
    expect(event.addMetadata).toHaveBeenCalledWith("extracted_values", {
      "{var1}": "019b3428-a0f0-d259-b764-ae0efbf37a64",
    });
  });

  it("should NOT normalize custom error classes", () => {
    const errorMessage = "Network timeout after 30 seconds";
    const event = createMockEvent("NetworkError", errorMessage) as Event;
    const originalErrorClass = event.errors[0].errorClass;

    handleBugsnagError(event, {});

    // Should NOT modify groupingHash
    expect(event.groupingHash).toBeUndefined();

    // Should NOT modify errorClass
    expect(event.errors[0].errorClass).toBe(originalErrorClass);
    expect(event.errors[0].errorClass).toBe("NetworkError");

    // Should still add context metadata (for all errors)
    expect(event.addMetadata).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });

    // Should NOT add extracted_values metadata
    expect(event.addMetadata).not.toHaveBeenCalledWith(
      "extracted_values",
      expect.anything(),
    );
  });

  it("should add custom grouping key to metadata when configured", () => {
    const event = createMockEvent(
      "Error",
      "Failed to fetch /api/data/12345",
    ) as Event;
    const customGroupingKey = "error_group";

    handleBugsnagError(event, { customGroupingKey });

    // Should add custom grouping key with normalized message
    expect(event.addMetadata).toHaveBeenCalledWith("custom", {
      [customGroupingKey]: "Failed to fetch /api/data/{var1}",
    });
  });

  it("should NOT add custom grouping key when not configured", () => {
    const event = createMockEvent(
      "Error",
      "Failed to fetch /api/data/12345",
    ) as Event;

    handleBugsnagError(event, {});

    // Should NOT add custom metadata
    expect(event.addMetadata).not.toHaveBeenCalledWith(
      "custom",
      expect.anything(),
    );
  });

  it("should NOT add extracted_values metadata when no values are extracted", () => {
    const event = createMockEvent("Error", "Simple error message") as Event;

    handleBugsnagError(event, {});

    // Should NOT add extracted_values metadata
    expect(event.addMetadata).not.toHaveBeenCalledWith(
      "extracted_values",
      expect.anything(),
    );

    // Should still add context
    expect(event.addMetadata).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
  });

  it("should handle multiple dynamic values in error message", () => {
    const event = createMockEvent(
      "Error",
      "Failed to copy /files/abc123defghi/item to /files/xyz789ghijkl/backup",
    ) as Event;

    handleBugsnagError(event, {});

    expect(event.groupingHash).toBe(
      "Failed to copy /files/{var1}/item to /files/{var2}/backup",
    );
    expect(event.addMetadata).toHaveBeenCalledWith("extracted_values", {
      "{var1}": "abc123defghi",
      "{var2}": "xyz789ghijkl",
    });
  });

  it("should preserve HTTP status codes in error messages", () => {
    const event = createMockEvent(
      "Error",
      "HTTP 502 Bad Gateway: Gateway timeout",
    ) as Event;

    handleBugsnagError(event, {});

    // HTTP status code should NOT be extracted
    expect(event.groupingHash).toBe("HTTP 502 Bad Gateway: Gateway timeout");
    expect(event.groupingHash).not.toContain("{var");
  });

  it("should extract hash values from error messages", () => {
    const event = createMockEvent(
      "Error",
      "Checksum mismatch: expected a1b2c3d4e5f67890123456789abcdef0",
    ) as Event;

    handleBugsnagError(event, {});

    expect(event.groupingHash).toBe("Checksum mismatch: expected {var1}");
    expect(event.addMetadata).toHaveBeenCalledWith("extracted_values", {
      "{var1}": "a1b2c3d4e5f67890123456789abcdef0",
    });
  });

  it("should add pathname context for all errors", () => {
    const genericError = createMockEvent("Error", "Generic error") as Event;
    const customError = createMockEvent(
      "ValidationError",
      "Validation failed",
    ) as Event;

    handleBugsnagError(genericError, {});
    handleBugsnagError(customError, {});

    // Both should have context metadata
    expect(genericError.addMetadata).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
    expect(customError.addMetadata).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
  });
});
