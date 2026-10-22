import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pipelineRunResourceInput } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";

import { AddResourceButton } from "./AddResourceButton";

const openDialog = vi.fn();
const createResource = vi.fn();
const notify = vi.fn();
const picker = vi.hoisted(() => vi.fn());

vi.mock("@/providers/DialogProvider/hooks/useDialog", () => ({
  useDialog: () => ({ open: openDialog }),
}));
vi.mock("@/services/projects/useProjectResources", () => ({
  useCreateProjectResource: () => ({
    mutate: createResource,
    isPending: false,
  }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/components/Project/AddPipelineDialog", () => ({
  AddPipelineDialog: (props: unknown) => {
    picker(props);
    return <div>Saved pipeline picker</div>;
  },
}));
vi.mock("@/routes/v2/pages/Tangent/components/AddPipelineRunDialog", () => ({
  AddPipelineRunDialog: () => null,
}));
vi.mock("@/routes/v2/pages/Tangent/components/AddDocumentDialog", () => ({
  AddDocumentDialog: () => null,
}));

describe("AddResourceButton", () => {
  afterEach(() => vi.clearAllMocks());

  it("opens the shared saved-pipeline picker with the project's resources", async () => {
    const user = userEvent.setup();
    const resources: ProjectResourceSummary[] = [];
    render(<AddResourceButton projectId="project-1" resources={resources} />);
    await user.click(screen.getByRole("button", { name: "Add a pipeline" }));
    expect(screen.getByText("Saved pipeline picker")).toBeInTheDocument();
    expect(picker).toHaveBeenLastCalledWith({
      projectId: "project-1",
      resources,
      onOpenChange: expect.any(Function),
    });
    expect(openDialog).not.toHaveBeenCalled();
  });

  it("does not attach a run already held by the project", async () => {
    const picked = pipelineRunResourceInput("run-1", "Run one");
    openDialog.mockResolvedValue(picked);
    const resources = [
      { ...picked, id: "resource-1" },
    ] as ProjectResourceSummary[];
    const user = userEvent.setup();
    render(<AddResourceButton projectId="project-1" resources={resources} />);
    await user.click(
      screen.getByRole("button", { name: "More resource types" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Add pipeline run" }),
    );
    expect(createResource).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      "Run one is already in this project",
      "info",
    );
  });
});
