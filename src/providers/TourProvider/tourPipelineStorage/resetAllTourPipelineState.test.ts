import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EDITOR_SPEC_QUERY_KEY } from "@/routes/v2/pages/Editor/hooks/useLoadSpec";

import { SESSION_KEY_PREFIX } from "./constants";
import { resetAllTourPipelineState } from "./resetAllTourPipelineState";

vi.mock("@/routes/v2/pages/Editor/hooks/useLoadSpec", () => ({
  EDITOR_SPEC_QUERY_KEY: "editor-v2-spec",
}));

afterEach(() => sessionStorage.clear());

describe("resetAllTourPipelineState", () => {
  it("clears account-scoped tour queries without removing ordinary editor data", () => {
    const client = new QueryClient();
    const tourKey = [EDITOR_SPEC_QUERY_KEY, "local", "__tour__first", null];
    const pipelineKey = [EDITOR_SPEC_QUERY_KEY, "local", "My pipeline", null];
    const otherKey = ["other-query", "local", "__tour__first"];
    client.setQueryData(tourKey, "Tour definition");
    client.setQueryData(pipelineKey, "My definition");
    client.setQueryData(otherKey, "Other data");
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}__tour__first`, "Tour");
    sessionStorage.setItem("unrelated", "Preserved");

    resetAllTourPipelineState(client);

    expect(client.getQueryData(tourKey)).toBeUndefined();
    expect(client.getQueryData(pipelineKey)).toBe("My definition");
    expect(client.getQueryData(otherKey)).toBe("Other data");
    expect(
      sessionStorage.getItem(`${SESSION_KEY_PREFIX}__tour__first`),
    ).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("Preserved");
    client.clear();
  });
});
