import { afterEach, describe, expect, it, vi } from "vitest";

import type { PreSubmitContext, PreSubmitHook } from "@/config/preSubmitHooks";

import { runPreSubmitHooks } from "./runPreSubmitHooks";

const ctx: PreSubmitContext = {
  componentSpec: { implementation: { container: { image: "test:latest" } } },
};

describe("runPreSubmitHooks", () => {
  afterEach(() => {
    delete window.__TANGLE_PRE_SUBMIT_HOOKS__;
    vi.restoreAllMocks();
  });

  it("proceeds when no hooks are registered", async () => {
    await expect(runPreSubmitHooks(ctx)).resolves.toBe(true);
  });

  it("proceeds when all hooks return proceed: true", async () => {
    window.__TANGLE_PRE_SUBMIT_HOOKS__ = [
      vi.fn(async () => ({ proceed: true })),
      vi.fn(async () => ({ proceed: true })),
    ];

    await expect(runPreSubmitHooks(ctx)).resolves.toBe(true);
  });

  it("halts when a hook returns proceed: false", async () => {
    const second = vi.fn(async () => ({ proceed: true }));
    window.__TANGLE_PRE_SUBMIT_HOOKS__ = [
      vi.fn(async () => ({ proceed: false })),
      second,
    ];

    await expect(runPreSubmitHooks(ctx)).resolves.toBe(false);
    expect(second).not.toHaveBeenCalled();
  });

  it("halts and warns when a hook throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.__TANGLE_PRE_SUBMIT_HOOKS__ = [
      vi.fn(async () => {
        throw new Error("boom");
      }),
    ];

    await expect(runPreSubmitHooks(ctx)).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("awaits hooks sequentially in registration order", async () => {
    const calls: string[] = [];
    const makeHook =
      (name: string): PreSubmitHook =>
      async () => {
        calls.push(`${name}:start`);
        await Promise.resolve();
        calls.push(`${name}:end`);
        return { proceed: true };
      };

    window.__TANGLE_PRE_SUBMIT_HOOKS__ = [makeHook("a"), makeHook("b")];

    await runPreSubmitHooks(ctx);

    expect(calls).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("passes the context through to each hook", async () => {
    const hook = vi.fn(async () => ({ proceed: true }));
    window.__TANGLE_PRE_SUBMIT_HOOKS__ = [hook];

    await runPreSubmitHooks(ctx);

    expect(hook).toHaveBeenCalledWith(ctx);
  });
});
