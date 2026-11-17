import { useState } from "react";

/**
 * Something built once for `key`, and built again when the key changes.
 * Moving to another project swaps what the page shows under a page that stays
 * mounted, so a value kept from the first project would keep acting on it.
 */
export function useBuiltFor<K, T>(key: K, build: () => T): T {
  const [built, setBuilt] = useState(() => ({ key, value: build() }));
  if (Object.is(built.key, key)) return built.value;

  const next = { key, value: build() };
  setBuilt(next);
  return next.value;
}
