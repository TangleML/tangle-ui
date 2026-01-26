import Bugsnag, { type Event } from "@bugsnag/js";
import { describe, expect, it, vi } from "vitest";

import { handleBugsnagError } from "./bugsnag";

const mockPathname = "/test/path";
Object.defineProperty(window, "location", {
  value: { pathname: mockPathname },
  writable: true,
});

const createTestEvent = (errorClass: string, errorMessage: string): Event => {
  let capturedEvent: Event | null = null;

  const testClient = Bugsnag.createClient({
    apiKey: "0123456789abcdef0123456789abcdef",
    onError: (event) => {
      event.errors[0].errorClass = errorClass;
      capturedEvent = event;
      return false;
    },
  });

  testClient.notify(new Error(errorMessage));

  if (!capturedEvent) {
    throw new Error("Failed to capture test event");
  }

  return capturedEvent;
};

describe("handleBugsnagError", () => {
  it("should normalize generic Error instances", () => {
    const event = createTestEvent(
      "Error",
      "HTTP 404 Not Found: /api/executions/019b3428-a0f0-d259-b764-ae0efbf37a64/status",
    );

    const addMetadataSpy = vi.spyOn(event, "addMetadata");
    handleBugsnagError(event);

    expect(event.groupingHash).toBe(
      "HTTP 404 Not Found: /api/executions/{var1}/status",
    );
    expect(event.errors[0].errorClass).toBe(
      "HTTP 404 Not Found: /api/executions/{var1}/status",
    );
    expect(addMetadataSpy).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
    expect(addMetadataSpy).toHaveBeenCalledWith("extracted_values", {
      "{var1}": "019b3428-a0f0-d259-b764-ae0efbf37a64",
    });
  });

  it("should NOT normalize custom error classes", () => {
    const errorMessage = "Network timeout after 30 seconds";
    const event = createTestEvent("NetworkError", errorMessage);
    const originalErrorClass = event.errors[0].errorClass;

    const addMetadataSpy = vi.spyOn(event, "addMetadata");
    handleBugsnagError(event);

    expect(event.errors[0].errorClass).toBe(originalErrorClass);
    expect(event.errors[0].errorClass).toBe("NetworkError");
    expect(event.groupingHash).toBeUndefined();
    expect(addMetadataSpy).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
    expect(addMetadataSpy).not.toHaveBeenCalledWith(
      "extracted_values",
      expect.anything(),
    );
  });

  it("should NOT add extracted_values metadata when no values are extracted", () => {
    const event = createTestEvent("Error", "Simple error message");

    const addMetadataSpy = vi.spyOn(event, "addMetadata");
    handleBugsnagError(event);

    expect(addMetadataSpy).not.toHaveBeenCalledWith(
      "extracted_values",
      expect.anything(),
    );
    expect(addMetadataSpy).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
  });

  it("should handle multiple dynamic values in error message", () => {
    const event = createTestEvent(
      "Error",
      "Failed to copy /files/abc123defghi/item to /files/xyz789ghijkl/backup",
    );

    const addMetadataSpy = vi.spyOn(event, "addMetadata");
    handleBugsnagError(event);

    expect(event.groupingHash).toBe(
      "Failed to copy /files/{var1}/item to /files/{var2}/backup",
    );
    expect(addMetadataSpy).toHaveBeenCalledWith("extracted_values", {
      "{var1}": "abc123defghi",
      "{var2}": "xyz789ghijkl",
    });
  });

  it("should preserve HTTP status codes in error messages", () => {
    const event = createTestEvent(
      "Error",
      "HTTP 502 Bad Gateway: Gateway timeout",
    );

    handleBugsnagError(event);

    expect(event.groupingHash).toBe("HTTP 502 Bad Gateway: Gateway timeout");
    expect(event.groupingHash).not.toContain("{var");
  });

  it("should extract hash values from error messages", () => {
    const event = createTestEvent(
      "Error",
      "Checksum mismatch: expected a1b2c3d4e5f67890123456789abcdef0",
    );

    const addMetadataSpy = vi.spyOn(event, "addMetadata");
    handleBugsnagError(event);

    expect(event.groupingHash).toBe("Checksum mismatch: expected {var1}");
    expect(addMetadataSpy).toHaveBeenCalledWith("extracted_values", {
      "{var1}": "a1b2c3d4e5f67890123456789abcdef0",
    });
  });

  it("should add pathname context for all errors", () => {
    const genericError = createTestEvent("Error", "Generic error");
    const customError = createTestEvent("ValidationError", "Validation failed");

    const addMetadataSpy1 = vi.spyOn(genericError, "addMetadata");
    const addMetadataSpy2 = vi.spyOn(customError, "addMetadata");

    handleBugsnagError(genericError);
    handleBugsnagError(customError);

    expect(addMetadataSpy1).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
    expect(addMetadataSpy2).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
  });

  it("should handle errors without throwing", () => {
    const event = createTestEvent("Error", "Test error");

    expect(() => handleBugsnagError(event)).not.toThrow();
  });
});

describe("createTestEvent", () => {
  it("should use onError callback that returns false to prevent sending", () => {
    let onErrorCalled = false;

    const testClient = Bugsnag.createClient({
      apiKey: "0123456789abcdef0123456789abcdef",
      onError: () => {
        onErrorCalled = true;
        return false;
      },
    });

    testClient.notify(
      new Error("Test error"),
      () => {},
      () => {},
    );

    expect(onErrorCalled).toBe(true);
  });
});
