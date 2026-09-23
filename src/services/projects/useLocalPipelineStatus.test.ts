import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResolvedPointers } from "@/services/localPipelines/useLocalPipelines";

import { localPipelineResourceInput } from "./resourceDescriptor";
import type { ProjectResourceSummary } from "./types";
import { useLocalPipelineStatus } from "./useLocalPipelineStatus";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: vi.fn(),
}));
vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useResolvedPointers: vi.fn(),
}));

import { useQuery } from "@tanstack/react-query";

// `localId: null` for "recorded no id": passing undefined to an optional
// parameter takes its default, which is an id.
function pipelineRow({
  id = "row-1",
  localName = "Draft",
  localId = "file-1" as string | null,
  createdBy = null as string | null,
}): ProjectResourceSummary {
  const input = localPipelineResourceInput({
    localName,
    localId: localId ?? undefined,
  });
  return {
    id,
    projectId: "project-1",
    entity: "document",
    name: input.name ?? null,
    entityId: null,
    extraData: input.extraData ?? null,
    createdBy,
    createdAt: new Date("2026-09-23T10:00:00Z"),
    updatedAt: new Date("2026-09-23T10:00:00Z"),
  };
}

function resolvesTo(resolved: Record<string, string | null> | undefined) {
  vi.mocked(useResolvedPointers).mockReturnValue({
    data: resolved,
  } as ReturnType<typeof useResolvedPointers>);
}

const status = (resources: ProjectResourceSummary[]) =>
  renderHook(() => useLocalPipelineStatus(resources)).result.current;

describe("useLocalPipelineStatus", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      data: { id: "ada@example.com" },
    } as ReturnType<typeof useQuery>);
  });
  afterEach(() => vi.resetAllMocks());

  /** The row records the name at the time it was added; renames move on. */
  it("reports what a reachable pipeline is called now", () => {
    resolvesTo({ "Draft|file-1": "Churn model" });

    const { currentNames, unavailable } = status([pipelineRow({})]);

    expect(currentNames.get("row-1")).toBe("Churn model");
    expect(unavailable.size).toBe(0);
  });

  it("reports a pipeline this browser does not hold as unavailable", () => {
    resolvesTo({ "Draft|file-1": null });

    const { currentNames, unavailable } = status([pipelineRow({})]);

    expect(unavailable.has("row-1")).toBe(true);
    expect(currentNames.has("row-1")).toBe(false);
  });

  /** Reading local storage is quick; flickering every row is not free. */
  it("says nothing at all while the lookup is running", () => {
    resolvesTo(undefined);

    const { currentNames, unavailable } = status([pipelineRow({})]);

    expect(unavailable.size).toBe(0);
    expect(currentNames.size).toBe(0);
  });

  /**
   * Someone else's "Churn model" is not the one this browser happens to hold,
   * and naming the row after it would be naming the wrong pipeline.
   */
  it("does not take a name-only pointer from another author", () => {
    resolvesTo({ "Churn model|": "Churn model" });

    const { currentNames, unavailable } = status([
      pipelineRow({
        localName: "Churn model",
        localId: null,
        createdBy: "someone-else@example.com",
      }),
    ]);

    expect(unavailable.has("row-1")).toBe(true);
    expect(currentNames.has("row-1")).toBe(false);
  });

  it("trusts a name-only pointer this browser wrote", () => {
    resolvesTo({ "Churn model|": "Churn model" });

    const { currentNames } = status([
      pipelineRow({
        localName: "Churn model",
        localId: null,
        createdBy: "ada@example.com",
      }),
    ]);

    expect(currentNames.get("row-1")).toBe("Churn model");
  });

  it("ignores a row that names no local pipeline", () => {
    resolvesTo({});

    const { currentNames, unavailable } = status([
      {
        ...pipelineRow({}),
        id: "row-doc",
        extraData: { type: "document" },
      },
    ]);

    expect(currentNames.size).toBe(0);
    expect(unavailable.size).toBe(0);
  });
});
