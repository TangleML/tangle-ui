import "./documentKind";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectResource } from "@/services/projects/types";
import { useProjectResource } from "@/services/projects/useProjectResources";

import { getWorkareaKind } from "./registry";
import type { WorkareaHostProps, WorkareaTab } from "./types";

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResource: vi.fn(),
}));

vi.mock("@/components/Project/DocumentEditor", () => ({
  DocumentEditor: ({
    projectId,
    resource,
  }: {
    projectId: string;
    resource: ProjectResource;
  }) => (
    <div data-testid="document-editor" data-project={projectId}>
      {String(resource.payload?.content)}
    </div>
  ),
}));

const tab: WorkareaTab = {
  id: "tab-1",
  title: "Model card",
  target: { type: "document", identity: "id/resource-7" },
};

function kind() {
  const registered = getWorkareaKind("document");
  if (!registered) throw new Error("document kind is not registered");
  return registered;
}

function renderDocument() {
  return render(
    <>{kind().render(tab, { projectId: "project-1" } as WorkareaHostProps)}</>,
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

  it("opens the document in the editor", () => {
    given({
      data: {
        name: "Model card",
        payload: { content: "Trained on Q3" },
      } as never,
    });

    renderDocument();

    expect(screen.getByTestId("document-editor")).toHaveTextContent(
      "Trained on Q3",
    );
    expect(screen.getByTestId("document-editor")).toHaveAttribute(
      "data-project",
      "project-1",
    );
    expect(useProjectResource).toHaveBeenCalledWith("project-1", "resource-7");
  });

  it("stays mounted in the background so an unsaved draft is not lost", () => {
    expect(kind().keepMounted).toBe(true);
  });

  it("passes on why it could not be loaded", () => {
    given({ data: undefined, error: new Error("Not found") });

    renderDocument();

    expect(screen.getByText("Not found")).toBeInTheDocument();
    expect(screen.queryByTestId("document-editor")).toBeNull();
  });
});
