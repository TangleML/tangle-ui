import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { remotePipelineResourceInput } from "@/services/projects/pipelineResource";
import { localPipelineResourceInput } from "@/services/projects/resourceDescriptor";
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

const PICKED_PIPELINE: CreateResourceInput = localPipelineResourceInput({
  localName: "Churn model",
  localId: "file-1",
});

function attachedRow(identity: string): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    metadata: {
      type: "local_pipeline",
      identity,
      fallbackName: "Churn model",
    },
    createdBy: null,
    createdAt: new Date("2026-09-22T10:00:00Z"),
    updatedAt: new Date("2026-09-22T10:00:00Z"),
  };
}

const SAVED_PIPELINE_ID = "71c26504-e061-4edb-a2f8-846bc960f8b2";

const PICKED_SAVED_PIPELINE = remotePipelineResourceInput(
  SAVED_PIPELINE_ID,
  "Churn model",
);

function savedPipelineRow(entityId: string): ProjectResourceSummary {
  return {
    ...attachedRow(""),
    entity: "pipeline",
    entityId,
    metadata: null,
  };
}

async function pickAPipeline(
  resources: ProjectResourceSummary[],
  picked: CreateResourceInput = PICKED_PIPELINE,
) {
  openDialog.mockResolvedValue(picked);
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

  it("recognises a pipeline attached under its name, before it had an id", async () => {
    await pickAPipeline([attachedRow("pipeline://name/Churn model")]);

    expect(createResource).not.toHaveBeenCalled();
  });

  it("attaches nothing when the project already holds the saved pipeline", async () => {
    await pickAPipeline(
      [savedPipelineRow(SAVED_PIPELINE_ID)],
      PICKED_SAVED_PIPELINE,
    );

    expect(createResource).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      "Churn model is already in this project",
      "info",
    );
  });

  it("attaches a saved pipeline the project does not hold yet", async () => {
    await pickAPipeline(
      [savedPipelineRow("2c2a8f3e-37c6-4a5e-9d5e-0b0f1f8d0c11")],
      PICKED_SAVED_PIPELINE,
    );

    expect(createResource).toHaveBeenCalledWith(PICKED_SAVED_PIPELINE);
  });
});
