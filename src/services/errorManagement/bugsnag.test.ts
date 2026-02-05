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
      capturedEvent = event;
      return false;
    },
  });

  testClient.notify(
    new Error(errorMessage),
    (event) => {
      event.errors[0].errorClass = errorClass;
    },
    () => {},
  );

  if (!capturedEvent) {
    throw new Error("Failed to capture test event");
  }

  return capturedEvent;
};

describe("handleBugsnagError", () => {
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
