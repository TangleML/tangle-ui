import { describe, expect, it } from "vitest";

import { router } from "./router";

describe("v2 path redirects", () => {
  it.each([
    ["/editor-v2", "/editor"],
    ["/editor-v2?fileId=abc", "/editor?fileId=abc"],
    ["/editor-v2/My%20Pipe?fileId=abc", "/editor/My%20Pipe?fileId=abc"],
    ["/runs-v2/01a0", "/runs/01a0"],
    ["/runs-v2/01a0/sub1?x=1", "/runs/01a0/sub1?x=1"],
    ["/runs-v2/01a0/sub1/sub2", "/runs/01a0/sub1/sub2"],
  ])("%s lands on %s", async (from, to) => {
    await router.navigate({ href: from });
    await router.load();

    expect(router.state.location.href).toBe(to);
  });
});

describe("run view routes", () => {
  it.each([
    ["/runs/01a0/sub1", "sub1"],
    ["/runs/01a0/sub1/sub2", "sub1/sub2"],
    ["/runs/01a0/sub1/sub2/sub3", "sub1/sub2/sub3"],
  ])("%s keeps every nested subgraph segment", async (href, splat) => {
    await router.navigate({ href });
    await router.load();

    expect(router.state.location.pathname).toBe(href);
    expect(router.state.matches.at(-1)?.params).toMatchObject({
      id: "01a0",
      _splat: splat,
    });
  });
});
