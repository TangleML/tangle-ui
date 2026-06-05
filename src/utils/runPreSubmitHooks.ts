import type { PreSubmitContext } from "@/config/preSubmitHooks";

export async function runPreSubmitHooks(
  ctx: PreSubmitContext,
): Promise<boolean> {
  const hooks = window.__TANGLE_PRE_SUBMIT_HOOKS__ ?? [];
  for (const hook of hooks) {
    try {
      const result = await hook(ctx);
      if (!result.proceed) {
        return false;
      }
    } catch (err) {
      console.warn(
        "[Tangle] Pre-submit hook threw, cancelling submission",
        err,
      );
      return false;
    }
  }
  return true;
}
