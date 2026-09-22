import "./documentKind";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProjectResource } from "@/services/projects/useProjectResources";

import { getWorkareaKind } from "./registry";
import type { WorkareaHostProps, WorkareaTab } from "./types";

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResource: vi.fn(),
}));

vi.mock("@/components/shared/CodeViewer", () => ({
  CodeViewer: ({ code, language }: { code: string; language: string }) => (
    <pre data-language={language}>{code}</pre>
  ),
  languageFor: (name: string | null) =>
    name?.endsWith(".md") ? "markdown" : "plaintext",
}));

const tab: WorkareaTab = {
  id: "tab-1",
  title: "Model card",
  target: { type: "document", identity: "id/resource-7" },
};

function renderDocument() {
  const kind = getWorkareaKind("document");
  if (!kind) throw new Error("document kind is not registered");
  return render(
    <>{kind.render(tab, { projectId: "project-1" } as WorkareaHostProps)}</>,
  );
}

function given(value: Partial<ReturnType<typeof useProjectResource>>) {
  vi.mocked(useProjectResource).mockReturnValue({
    isPending: false,
    error: null,
    ...value,
  } as unknown as ReturnType<typeof useProjectResource>);
}

describe("documentKind", () => {
  afterEach(() => vi.resetAllMocks());

  it("shows what the document says", () => {
    given({
      data: {
        name: "Model card",
        payload: { content: "Trained on Q3" },
      } as never,
    });

    renderDocument();

    expect(screen.getByText("Trained on Q3")).toBeInTheDocument();
    expect(useProjectResource).toHaveBeenCalledWith("project-1", "resource-7");
  });

  it("highlights by the name the author gave it", () => {
    given({
      data: { name: "notes.md", payload: { content: "# Heading" } } as never,
    });

    renderDocument();

    expect(screen.getByText("# Heading")).toHaveAttribute(
      "data-language",
      "markdown",
    );
  });

  /** Anyone may PATCH a payload, so an empty one has to read as something. */
  it("says so rather than rendering nothing when there is no body", () => {
    given({ data: { name: "Model card", payload: {} } as never });

    renderDocument();

    expect(
      screen.getByText("This document has nothing written in it."),
    ).toBeInTheDocument();
  });

  it("passes on why it could not be loaded", () => {
    given({ data: undefined, error: new Error("Not found") });

    renderDocument();

    expect(screen.getByText("Not found")).toBeInTheDocument();
  });
});
