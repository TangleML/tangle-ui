import type { ResolvedWorkareaView } from "@/routes/v2/pages/Tangent/workarea/types";

export interface ResolveWorkareaTargetOptions {
  title?: string;
}

/**
 * Resolves a string target into a concrete workarea view. PR 2 handles only
 * `http(s)` artifact URLs; `pipeline://` and run targets are added by PR 3 when
 * those workarea kinds register.
 */
export function resolveWorkareaTarget(
  target: string,
  options: ResolveWorkareaTargetOptions = {},
): ResolvedWorkareaView {
  const trimmed = target.trim();
  if (/^https?:\/\//.test(trimmed)) {
    return { kind: "artifact", title: options.title ?? trimmed, url: trimmed };
  }
  throw new Error(`Unsupported workarea target: ${target}`);
}
