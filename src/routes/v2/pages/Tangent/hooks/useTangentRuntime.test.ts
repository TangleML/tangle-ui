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

  it("has no url to offer when there is no origin to hang it off", () => {
    expect(tangentChannelUrl(null)).toBeNull();
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

  // Importing a guessed url is what a null is there to avoid: a page that has
  // not learned where Tangent lives must not reach for one meanwhile.
  it("imports nothing while it has no url", async () => {
    const { result, rerender } = renderHook(
      ({ url }: { url: string | null }) => useTangentRuntime(url),
      { initialProps: { url: null as string | null } },
    );

    expect(result.current).toBe("loading");

    rerender({ url: "https://tangent.invalid/embed/v1/tangent-elements.js" });
    await waitFor(() => expect(result.current).toBe("unreachable"));
  });
});
