import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ErrorContext } from "./types";

// Mock the config
vi.mock("./config", () => ({
  getBugsnagConfig: () => ({
    enabled: true,
    apiKey: "test-api-key",
    notifyEndpoint: "https://test.bugsnag.com/notify",
    sessionsEndpoint: "https://test.bugsnag.com/sessions",
    customGroupingKey: "grouping_key",
  }),
}));

// Import after mocking
const { BugsnagClient } = await import("./bugsnagClient");

describe("BugsnagClient - Error Normalization", () => {
  let client: any;
  let fetchMock: any;

  beforeEach(() => {
    client = new (BugsnagClient as any)();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = fetchMock;
    vi.useFakeTimers();
  });

  afterEach(() => {
    client.cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("extractAndNormalizeErrorClass", () => {
    it("extracts and replaces numeric IDs in URLs", () => {
      const message = "Failed to fetch user from /users/12345/profile";
      const result = client.extractAndNormalizeErrorClass(message);

      expect(result.normalizedMessage).toBe(
        "Failed to fetch user from /users/{var1}/profile",
      );
      expect(result.extractedValues["{var1}"]).toBe("12345");
    });

    it("extracts and replaces UUIDs", () => {
      const message =
        "Error in execution /executions/550e8400-e29b-41d4-a716-446655440000/status";
      const result = client.extractAndNormalizeErrorClass(message);

      expect(result.normalizedMessage).toBe(
        "Error in execution /executions/{var1}/status",
      );
      expect(result.extractedValues["{var1}"]).toBe(
        "550e8400-e29b-41d4-a716-446655440000",
      );
    });

    it("extracts and replaces quoted strings", () => {
      const message = 'Component "MyComponent" failed to load';
      const result = client.extractAndNormalizeErrorClass(message);

      expect(result.normalizedMessage).toBe("Component {var1} failed to load");
      expect(result.extractedValues["{var1}"]).toBe("MyComponent");
    });

    it("extracts and replaces large numbers but preserves HTTP status codes", () => {
      const message =
        "HTTP 404 Not Found: Execution with id 12345 not found after 5000ms";
      const result = client.extractAndNormalizeErrorClass(message);

      // Note: "12345" after "id" is treated as a number, not in a path
      expect(result.normalizedMessage).toContain("HTTP 404");
      expect(result.normalizedMessage).toContain("{var");
      expect(Object.keys(result.extractedValues).length).toBeGreaterThan(0);
    });

    it("preserves plain words in URLs like 'services'", () => {
      const message =
        "Network error: Failed to fetch (URL: http://localhost:9500/services/ping)";
      const result = client.extractAndNormalizeErrorClass(message);

      expect(result.normalizedMessage).toContain("/services/ping");
      expect(result.extractedValues["{var1}"]).toBe("9500");
    });

    it("extracts multiple IDs and names with incrementing counters", () => {
      const message =
        'Error in "Component1" at /path/123/sub/456 for "Component2"';
      const result = client.extractAndNormalizeErrorClass(message);

      // Path IDs are extracted before quoted strings, so:
      // /path/123 -> {var1}, /sub/456 -> {var2}, "Component1" -> {var3}, "Component2" -> {var4}
      expect(result.normalizedMessage).toBe(
        "Error in {var3} at /path/{var1}/sub/{var2} for {var4}",
      );
      expect(result.extractedValues["{var1}"]).toBe("123");
      expect(result.extractedValues["{var2}"]).toBe("456");
      expect(result.extractedValues["{var3}"]).toBe("Component1");
      expect(result.extractedValues["{var4}"]).toBe("Component2");
    });

    it("truncates normalized message to 200 characters", () => {
      const longMessage = "Error: " + "A".repeat(300);
      const result = client.extractAndNormalizeErrorClass(longMessage);

      // The original message gets normalized (spaces might be collapsed)
      expect(result.normalizedMessage.length).toBeLessThanOrEqual(200);
      if (result.normalizedMessage.length === 200) {
        expect(result.normalizedMessage.endsWith("...")).toBe(true);
      }
    });

    it("handles query parameters with IDs", () => {
      const message =
        "Request failed for http://api.com/users?id=abc123def&token=xyz789";
      const result = client.extractAndNormalizeErrorClass(message);

      expect(result.normalizedMessage).toContain("?id={var1}");
      expect(result.extractedValues["{var1}"]).toBe("abc123def");
    });
  });

  describe("parseStackTrace", () => {
    it("parses standard stack trace format", () => {
      const error = new Error("Test error");
      error.stack = `Error: Test error
    at functionName (http://localhost:5000/src/file.ts:10:20)
    at anotherFunction (http://localhost:5000/src/other.ts:30:40)`;

      const result = client.parseStackTrace(error);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        method: "functionName",
        file: "http://localhost:5000/src/file.ts",
        lineNumber: 10,
        columnNumber: 20,
      });
      expect(result[1]).toEqual({
        method: "anotherFunction",
        file: "http://localhost:5000/src/other.ts",
        lineNumber: 30,
        columnNumber: 40,
      });
    });

    it("parses anonymous function stack trace", () => {
      const error = new Error("Test error");
      error.stack = `Error: Test error
    at http://localhost:5000/src/file.ts:10:20`;

      const result = client.parseStackTrace(error);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        method: "(anonymous)",
        file: "http://localhost:5000/src/file.ts",
        lineNumber: 10,
        columnNumber: 20,
      });
    });

    it("handles empty stack trace", () => {
      const error = new Error("Test error");
      error.stack = "";

      const result = client.parseStackTrace(error);

      expect(result).toHaveLength(0);
    });
  });
});

describe("BugsnagClient - Rate Limiting & Spam Prevention", () => {
  let client: any;
  let fetchMock: any;

  beforeEach(() => {
    client = new (BugsnagClient as any)();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = fetchMock;
    vi.useFakeTimers();
  });

  afterEach(() => {
    client.cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("sends errors instantly in normal mode", async () => {
    const error1 = new Error("Test error 1");
    const error2 = new Error("Test error 2");

    await client.notify(error1);
    await client.notify(error2);

    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("enters spam mode after exceeding threshold", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Send 6 errors rapidly (threshold is 5 in 10 seconds)
    // The 6th error triggers spam mode, so it gets queued
    for (let i = 1; i <= 6; i++) {
      client.notify(new Error(`Test error ${i}`));
    }

    // Wait for all promises to resolve
    await vi.runOnlyPendingTimersAsync();

    // First 5 should be sent immediately, 6th is queued (triggers spam mode)
    // So we expect either 5 or 6 depending on timing
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Spam threshold exceeded"),
    );

    consoleWarnSpy.mockRestore();
  });

  it("batches errors in spam mode and sends every 15 seconds", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Trigger spam mode
    for (let i = 1; i <= 6; i++) {
      client.notify(new Error(`Test error ${i}`));
    }

    await vi.runOnlyPendingTimersAsync();
    fetchMock.mockClear();

    // Add more errors while in spam mode
    client.notify(new Error("Batched error 1"));
    client.notify(new Error("Batched error 2"));
    client.notify(new Error("Batched error 3"));

    // No errors sent yet
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance time by 15 seconds (batch interval)
    await vi.advanceTimersByTimeAsync(15000);

    // Batch should be sent
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Sending batch of 3 errors"),
    );

    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("exits spam mode after 60 seconds and returns to instant sending", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Trigger spam mode
    for (let i = 1; i <= 6; i++) {
      client.notify(new Error(`Test error ${i}`));
    }

    await vi.runOnlyPendingTimersAsync();
    fetchMock.mockClear();
    consoleLogSpy.mockClear(); // Clear any batch send logs

    // Advance time by 60 seconds (spam mode reset window)
    await vi.advanceTimersByTimeAsync(60000);

    // Now send a new error which will trigger the spam mode check
    // This should detect that 60 seconds have passed and exit spam mode
    client.notify(new Error("Trigger reset check"));
    await vi.runOnlyPendingTimersAsync();

    // The exit spam mode message should be logged
    const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
    const hasResetMessage = logCalls.some(
      (msg) => typeof msg === "string" && msg.includes("Spam mode reset"),
    );
    expect(hasResetMessage).toBe(true);

    // Next error should be sent instantly (not queued)
    fetchMock.mockClear();
    client.notify(new Error("After reset error"));
    await vi.runOnlyPendingTimersAsync();

    expect(fetchMock).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("sends remaining queued errors on cleanup", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Trigger spam mode
    for (let i = 1; i <= 6; i++) {
      client.notify(new Error(`Test error ${i}`));
    }

    await vi.runOnlyPendingTimersAsync();
    fetchMock.mockClear();

    // Queue some errors
    client.notify(new Error("Queued error 1"));
    client.notify(new Error("Queued error 2"));

    // Cleanup should send queued errors
    client.cleanup();
    await vi.runOnlyPendingTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    consoleWarnSpy.mockRestore();
  });

  it("clears batch interval on cleanup", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Trigger spam mode
    for (let i = 1; i <= 6; i++) {
      client.notify(new Error(`Test error ${i}`));
    }

    expect(client.batchInterval).not.toBeNull();

    client.cleanup();

    expect(client.batchInterval).toBeNull();
    expect(client.isSpamMode).toBe(false);
    expect(client.errorQueue).toHaveLength(0);

    consoleWarnSpy.mockRestore();
  });
});

describe("BugsnagClient - notify API", () => {
  let client: any;
  let fetchMock: any;

  beforeEach(() => {
    client = new (BugsnagClient as any)();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = fetchMock;
    vi.useFakeTimers();
  });

  afterEach(() => {
    client.cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("includes extracted values in metadata", async () => {
    const error = new Error(
      'Failed to load user /users/12345 named "John Doe"',
    );

    await client.notify(error);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);

    expect(payload.events[0].metaData.extracted_values).toEqual({
      "{var1}": "12345",
      "{var2}": "John Doe",
    });
  });

  it("includes custom metadata from context", async () => {
    const error = new Error("Test error");
    const context: ErrorContext = {
      userId: "user-123",
      requestId: "req-456",
      metadata: {
        custom: "value",
        count: 42,
      },
    };

    await client.notify(error, context);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);

    expect(payload.events[0].user).toEqual({ id: "user-123" });
    expect(payload.events[0].metaData.cgi_data).toEqual({
      REQUEST_ID: "req-456",
    });
    expect(payload.events[0].metaData.custom).toEqual({
      custom: "value",
      count: 42,
      grouping_key: "Test error",
    });
  });

  it("uses normalized message as error class", async () => {
    const error = new Error(
      'Failed for user in path /users/12345 in "Component"',
    );

    await client.notify(error);
    await vi.runAllTimersAsync();

    const callArgs = fetchMock.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);

    // The message contains "/users/12345" which becomes "/users/{var1}"
    expect(payload.events[0].exceptions[0].errorClass).toContain("{var1}");
    expect(payload.events[0].exceptions[0].errorClass).toContain("{var2}");
    expect(payload.events[0].exceptions[0].message).toBe(
      'Failed for user in path /users/12345 in "Component"',
    );
  });

  it("handles fetch errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("Network failure"));

    const error = new Error("Test error");

    await expect(client.notify(error)).resolves.not.toThrow();
    await vi.runAllTimersAsync();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to send error to Bugsnag:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});

describe("BugsnagClient - isEnabled", () => {
  it("returns true when config is enabled", () => {
    const client = new (BugsnagClient as any)();
    expect(client.isEnabled()).toBe(true);
  });
});
