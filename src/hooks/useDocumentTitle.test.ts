import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDocumentTitle } from "./useDocumentTitle";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => ({ resolvedLocation: { pathname: mocks.pathname } }),
}));

describe("useDocumentTitle", () => {
  beforeEach(() => {
    document.title = "Previous page";
  });

  it("titles the editor with the decoded pipeline name", () => {
    mocks.pathname = "/editor/My%20Pipeline";
    renderHook(() => useDocumentTitle());

    expect(document.title).toBe("Tangle - My Pipeline");
  });

  it("keeps a malformed pipeline name as it appears in the path", () => {
    mocks.pathname = "/editor/100%";
    renderHook(() => useDocumentTitle());

    expect(document.title).toBe("Tangle - 100%");
  });

  it("titles the editor before a pipeline is open", () => {
    mocks.pathname = "/editor";
    renderHook(() => useDocumentTitle());

    expect(document.title).toBe("Tangle - Open Pipeline");
  });

  it("leaves run titles to the run view", () => {
    document.title = "Tangle - Test Pipeline - run-1";
    mocks.pathname = "/runs/run-1/subgraph-1";
    renderHook(() => useDocumentTitle());

    expect(document.title).toBe("Tangle - Test Pipeline - run-1");
  });
});
