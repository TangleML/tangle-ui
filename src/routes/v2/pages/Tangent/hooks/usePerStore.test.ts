import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { usePerStore } from "./usePerStore";

describe("usePerStore", () => {
  it("keeps what it built for a store, and builds again for the next project", () => {
    const first = new TangentProjectStore("project-1");
    const second = new TangentProjectStore("project-2");
    const { result, rerender } = renderHook(
      ({ store }) => usePerStore(store, () => ({ projectId: store.projectId })),
      { initialProps: { store: first } },
    );
    const built = result.current;

    rerender({ store: first });
    expect(result.current).toBe(built);

    rerender({ store: second });
    expect(result.current).toEqual({ projectId: "project-2" });
  });
});
