import { getWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type {
  ResolvedWorkareaView,
  WorkareaTarget,
} from "@/routes/v2/pages/Tangent/workarea/types";

export interface ResolveWorkareaTargetOptions {
  title?: string;
}

/**
 * Resolves a caller-constructed `WorkareaTarget` into a view ready to become a
 * tab. The only work left is title resolution, which each kind owns (a pipeline
 * looks its name up in the registry); the shape is otherwise passed through.
 */
export async function resolveWorkareaTarget(
  target: WorkareaTarget,
  options: ResolveWorkareaTargetOptions = {},
): Promise<ResolvedWorkareaView> {
  const kind = getWorkareaKind(target.type);
  if (!kind) {
    throw new Error(`Unsupported workarea target type: ${target.type}`);
  }
  const title = options.title ?? (await kind.resolveTitle(target));
  return { title, target };
}
