import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";

import { AddResourceButton } from "./AddResourceButton";

const openDialog = vi.fn();
const createResource = vi.fn();
const notify = vi.fn();

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

// The pickers reach the pipeline and run lists, and through them the whole
// editor tree, which does not survive being imported on its own.
vi.mock("@/routes/v2/pages/Tangent/components/AddPipelineDialog", () => ({
  AddPipelineDialog: () => null,
}));
vi.mock("@/routes/v2/pages/Tangent/components/AddPipelineRunDialog", () => ({
  AddPipelineRunDialog: () => null,
}));
vi.mock("@/routes/v2/pages/Tangent/components/AddDocumentDialog", () => ({
  AddDocumentDialog: () => null,
}));

const PICKED_PIPELINE: CreateResourceInput = {
  entity: "document",
  name: "Churn model",
  metadata: { type: "local_pipeline", identity: "pipeline://id/file-1" },
};

function attachedRow(identity: string): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    metadata: { type: "local_pipeline", identity },
    createdBy: null,
    createdAt: new Date("2026-09-22T10:00:00Z"),
    updatedAt: new Date("2026-09-22T10:00:00Z"),
  };
}

async function pickAPipeline(resources: ProjectResourceSummary[]) {
  openDialog.mockResolvedValue(PICKED_PIPELINE);
  const user = userEvent.setup();
  render(<AddResourceButton projectId="project-1" resources={resources} />);

  await user.click(screen.getByRole("button", { name: "Add a pipeline" }));
}

describe("AddResourceButton", () => {
  afterEach(() => vi.resetAllMocks());

  it("attaches a pipeline the project does not hold yet", async () => {
    await pickAPipeline([]);

    expect(createResource).toHaveBeenCalledWith(PICKED_PIPELINE);
  });

  it("attaches nothing when the project already holds it", async () => {
    await pickAPipeline([attachedRow("pipeline://id/file-1")]);

    expect(createResource).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      "Churn model is already in this project",
      "info",
    );
  });

  it("attaches a different pipeline of the same name", async () => {
    await pickAPipeline([attachedRow("pipeline://id/file-2")]);

    expect(createResource).toHaveBeenCalledWith(PICKED_PIPELINE);
  });
});
