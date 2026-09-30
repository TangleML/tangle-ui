import { RunContext } from "@openai/agents-core";
import { describe, expect, it, vi } from "vitest";

import { createComponentCatalog } from "../componentCatalog";
import type { AgentSession } from "../session";
import type { ToolBridgeApi } from "../toolBridgeApi";
import { createComponentSearchTools } from "./componentSearchTools";

function searchResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "abc123",
    name: "Filter text",
    description: "Filters text.",
    source: "User",
    matchedFields: ["name"],
    inputs: ["text"],
    outputs: ["filtered_text"],
    componentRef: {
      name: "Filter text",
      spec: {
        name: "Filter text",
        implementation: { container: { image: "python:3.11" } },
      },
    },
    yamlText: "name: Filter text\n",
    ...overrides,
  };
}

function makeSession(results: ReturnType<typeof searchResult>[]) {
  const searchComponents = vi
    .fn()
    .mockResolvedValue({ success: true, results });
  return {
    session: {
      bridge: { searchComponents } as unknown as ToolBridgeApi,
      componentReferences: {},
      componentCatalog: createComponentCatalog(),
    } as unknown as AgentSession,
    searchComponents,
  };
}

async function search(session: AgentSession, query = "filter text") {
  const { searchComponents } = createComponentSearchTools(session);
  const raw = await searchComponents.invoke(
    new RunContext(),
    JSON.stringify({ query }),
  );
  return JSON.parse(raw as string) as {
    results: Array<Record<string, unknown>>;
  };
}

describe("createComponentSearchTools", () => {
  it("keeps each result's component for add_task to resolve", async () => {
    const result = searchResult();
    const { session } = makeSession([result]);

    await search(session);

    expect(session.componentCatalog.lookup("abc123")).toEqual(
      result.componentRef,
    );
  });

  /**
   * The spec is what makes a search result enormous — one user component in a
   * real session ran to 20k characters — and the model has no use for it now
   * that the id resolves to the whole thing.
   */
  it("does not send the component back to the model", async () => {
    const { session } = makeSession([searchResult()]);

    const parsed = await search(session);

    expect(parsed.results[0]).not.toHaveProperty("componentRef");
    expect(parsed.results[0]).not.toHaveProperty("yamlText");
    expect(parsed.results[0]?.id).toBe("abc123");
  });

  it("still records the YAML the chat needs to render a component link", async () => {
    const { session } = makeSession([searchResult()]);

    const parsed = await search(session);

    expect(session.componentReferences.abc123).toEqual({
      name: "Filter text",
      yamlText: "name: Filter text\n",
    });
    expect(parsed.results[0]?.componentLink).toBe(
      "[Filter text](component://abc123)",
    );
  });

  it("keeps a result whose YAML the bridge could not produce resolvable", async () => {
    const { session } = makeSession([searchResult({ yamlText: null })]);

    await search(session);

    expect(session.componentCatalog.lookup("abc123")).toBeDefined();
    expect(session.componentReferences.abc123).toBeUndefined();
  });
});
