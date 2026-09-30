import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useLoadUserPipelines from "@/hooks/useLoadUserPipelines";

import PipelineNameDialog from "./PipelineNameDialog";

vi.mock("@/hooks/useLoadUserPipelines");

describe("PipelineNameDialog", () => {
  beforeEach(() => {
    vi.mocked(useLoadUserPipelines).mockReturnValue({
      userPipelines: new Map([["Migrated pipeline", {} as never]]),
      isLoadingUserPipelines: false,
      refetch: vi.fn(),
    });
  });

  it("rejects duplicate browser-local pipeline names by default", () => {
    render(
      <PipelineNameDialog
        open
        title="Rename Pipeline"
        initialName="Current pipeline"
        submitButtonText="Rename"
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Migrated pipeline" },
    });

    expect(screen.getByText("Name already exists")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
  });

  it("ignores hidden local recovery names for remote destinations", () => {
    render(
      <PipelineNameDialog
        open
        title="Rename Pipeline"
        initialName="Current pipeline"
        submitButtonText="Rename"
        onSubmit={vi.fn()}
        validateLocalPipelineName={false}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Migrated pipeline" },
    });

    expect(screen.queryByText("Name already exists")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeEnabled();
  });
});
