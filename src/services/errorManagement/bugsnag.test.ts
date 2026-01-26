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
    addMetadata: vi.fn(),
  }) as unknown as Event;

describe("handleBugsnagError", () => {
  it("should add pathname context for all errors", () => {
    const genericError = createMockEvent("Error", "Generic error") as Event;
    const customError = createMockEvent(
      "ValidationError",
      "Validation failed",
    ) as Event;

    handleBugsnagError(genericError);
    handleBugsnagError(customError);

    // Both should have context metadata
    expect(genericError.addMetadata).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
    expect(customError.addMetadata).toHaveBeenCalledWith("context", {
      pathname: mockPathname,
    });
  });

  it("should handle errors without throwing", () => {
    const event = createMockEvent("Error", "Test error") as Event;

    expect(() => handleBugsnagError(event)).not.toThrow();
  });
});
