import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit } from "./rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("executes requests at the specified rate", async () => {
    const rate = 2;
    const waitMs = 1000 / rate;

    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = rateLimit(mockFn, { rate, bucketSize: 1 });

    const promise1 = rateLimitedFn();
    const promise2 = rateLimitedFn();
    const promise3 = rateLimitedFn();

    await vi.advanceTimersByTimeAsync(0);
    expect(mockFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(waitMs);
    expect(mockFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(waitMs);
    expect(mockFn).toHaveBeenCalledTimes(3);

    await expect(promise1).resolves.toBe("result");
    await expect(promise2).resolves.toBe("result");
    await expect(promise3).resolves.toBe("result");

    rateLimitedFn.dispose();
  });

  it("allows burst requests when bucketSize > 1", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = rateLimit(mockFn, { rate: 1, bucketSize: 3 });

    rateLimitedFn();
    rateLimitedFn();
    rateLimitedFn();
    rateLimitedFn();

    await vi.advanceTimersByTimeAsync(0);

    // First 3 requests execute immediately (3 tokens available)
    expect(mockFn).toHaveBeenCalledTimes(3);

    // 4th request waits for token refill
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFn).toHaveBeenCalledTimes(4);

    rateLimitedFn.dispose();
  });

  it("rejects pending requests when disposed", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = rateLimit(mockFn, { rate: 1, bucketSize: 1 });

    const promise1 = rateLimitedFn();
    const promise2 = rateLimitedFn();

    await vi.advanceTimersByTimeAsync(0);
    expect(mockFn).toHaveBeenCalledTimes(1);

    rateLimitedFn.dispose();

    await expect(promise1).resolves.toBe("result");
    await expect(promise2).rejects.toThrow("Rate limiter disposed");
  });

  it("rejects calls made after dispose", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = rateLimit(mockFn, { rate: 5 });

    rateLimitedFn.dispose();

    await expect(rateLimitedFn()).rejects.toThrow(
      "Rate limiter has been disposed",
    );
    expect(mockFn).not.toHaveBeenCalled();
  });

  it("passes arguments to the wrapped function", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = rateLimit(mockFn, { rate: 5 });

    rateLimitedFn("arg1", 42, { key: "value" });
    await vi.advanceTimersByTimeAsync(0);

    expect(mockFn).toHaveBeenCalledWith("arg1", 42, { key: "value" });

    rateLimitedFn.dispose();
  });

  it("throws on invalid rate parameter", () => {
    const mockFn = vi.fn().mockResolvedValue("result");

    expect(() => rateLimit(mockFn, { rate: 0 })).toThrow(
      "Rate must be a positive finite integer number",
    );
    expect(() => rateLimit(mockFn, { rate: -1 })).toThrow(
      "Rate must be a positive finite integer number",
    );
    expect(() => rateLimit(mockFn, { rate: 1.5 })).toThrow(
      "Rate must be a positive finite integer number",
    );
    expect(() => rateLimit(mockFn, { rate: Infinity })).toThrow(
      "Rate must be a positive finite integer number",
    );
  });

  it("throws on invalid bucketSize parameter", () => {
    const mockFn = vi.fn().mockResolvedValue("result");

    expect(() => rateLimit(mockFn, { rate: 5, bucketSize: 0 })).toThrow(
      "Bucket size must be a positive finite integer number",
    );
    expect(() => rateLimit(mockFn, { rate: 5, bucketSize: -1 })).toThrow(
      "Bucket size must be a positive finite integer number",
    );
    expect(() => rateLimit(mockFn, { rate: 5, bucketSize: 1.5 })).toThrow(
      "Bucket size must be a positive finite integer number",
    );
  });

  it("uses default rate when not specified", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = rateLimit(mockFn);

    rateLimitedFn();
    rateLimitedFn();

    await vi.advanceTimersByTimeAsync(0);
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Default rate is 5/sec = 200ms per token
    await vi.advanceTimersByTimeAsync(200);
    expect(mockFn).toHaveBeenCalledTimes(2);

    rateLimitedFn.dispose();
  });
});
