import { useState } from "react";

import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

/**
 * Something built once from the project's store, and again for the next store.
 * Opening another project swaps the store under a page that stays mounted, so
 * a value kept from the first store would keep acting on the first project.
 */
export function usePerStore<T>(store: TangentProjectStore, build: () => T): T {
  const [built, setBuilt] = useState(() => ({ store, value: build() }));
  if (built.store === store) return built.value;

  const next = { store, value: build() };
  setBuilt(next);
  return next.value;
}
