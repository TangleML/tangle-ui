import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { tangentChannelUrl, useTangentRuntime } from "./useTangentRuntime";

describe("tangentChannelUrl", () => {
  it("hangs the runtime bundle off the given origin", () => {
    expect(tangentChannelUrl("https://tangent.example")).toBe(
      "https://tangent.example/embed/v1/tangent-elements.js",
    );
  });

  it("does not double the slash when the base url has a trailing one", () => {
    expect(tangentChannelUrl("https://tangent.example//")).toBe(
      "https://tangent.example/embed/v1/tangent-elements.js",
    );
  });
});

describe("useTangentRuntime", () => {
  it("reports a runtime that cannot be fetched rather than waiting forever", async () => {
    const { result } = renderHook(() =>
      useTangentRuntime("https://tangent.invalid/embed/v1/tangent-elements.js"),
    );

    expect(result.current).toBe("loading");
    await waitFor(() => expect(result.current).toBe("unreachable"));
  });

  it("starts over when the project points at a different Tangent", async () => {
    const { result, rerender } = renderHook(
      ({ url }) => useTangentRuntime(url),
      { initialProps: { url: "https://one.invalid/a.js" } },
    );

    await waitFor(() => expect(result.current).toBe("unreachable"));

    rerender({ url: "https://two.invalid/b.js" });
    expect(result.current).toBe("loading");
  });
});
