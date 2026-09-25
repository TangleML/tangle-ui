import type { Flag } from "@/types/configuration";

import { hasSatisfiedDependencies } from "./flagDependencies";

/**
 * Drops flags whose `dependsOn` chain is not fully enabled, so a dependent flag
 * never renders as a toggle that controls an unreachable feature.
 */
export function resolveVisibleFlags(flags: Flag[]): Flag[] {
  const flagsByKey = new Map(flags.map((flag) => [flag.key, flag]));

  return flags.filter((flag) =>
    hasSatisfiedDependencies(flag.key, (key) => flagsByKey.get(key)),
  );
}
