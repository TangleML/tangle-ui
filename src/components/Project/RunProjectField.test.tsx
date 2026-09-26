import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PipelineProjectMembership } from "@/services/projects/usePipelineProjects";
import { usePipelineProjects } from "@/services/projects/usePipelineProjects";

import { RunProjectField } from "./RunProjectField";
import { useRunProjectContext } from "./useRunProjectContext";

const setProjectId = vi.fn();
const onChange = vi.fn();

vi.mock("./useRunProjectContext", () => ({
  useRunProjectContext: vi.fn(),
}));

vi.mock("@/services/projects/usePipelineProjects", () => ({
  usePipelineProjects: vi.fn(),
}));

function membership(id: string, name: string): PipelineProjectMembership {
  return {
    project: { id, name } as PipelineProjectMembership["project"],
    resource: { id: `resource-${id}` } as PipelineProjectMembership["resource"],
  };
}

function given({
  enabled = true,
  projectName,
  memberships = [],
}: {
  enabled?: boolean;
  projectName?: string;
  memberships?: PipelineProjectMembership[];
} = {}) {
  vi.mocked(useRunProjectContext).mockReturnValue({
    enabled,
    projectId: undefined,
    projectName,
    projectIds: [],
    setProjectId,
    dismiss: vi.fn(),
  });
  vi.mocked(usePipelineProjects).mockReturnValue({
    memberships,
    isPending: false,
  });
}

const field = (value?: string) =>
  render(
    <RunProjectField
      pipelineName="Churn model"
      value={value}
      onChange={onChange}
    />,
  );

describe("RunProjectField", () => {
  // Radix Select drives itself with pointer capture, which jsdom does not
  // implement, so opening it throws before anything under test runs.
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() =>
    given({
      memberships: [
        membership("project-1", "Churn work"),
        membership("project-2", "Q3 models"),
      ],
    }),
  );
  afterEach(() => vi.resetAllMocks());

  it("asks for nothing while projects are switched off", () => {
    given({ enabled: false });

    const { container } = field();

    expect(container).toBeEmptyDOMElement();
  });

  it("asks for nothing when the pipeline is in no project", () => {
    given();

    const { container } = field();

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Attribution is written once, so the choice belongs to the submission being
   * made and must not follow the editor into the next one.
   */
  it("reports the choice without touching the tab's own project", async () => {
    field("project-1");

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Q3 models" }));

    expect(onChange).toHaveBeenCalledWith("project-2");
    expect(setProjectId).not.toHaveBeenCalled();
  });

  it("lets a run be attributed to nothing", async () => {
    field("project-1");

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "No project" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  /** The tab's project need not be one the pipeline was ever added to. */
  it("offers the project it was handed even when the pipeline is not in it", () => {
    given({ projectName: "Somebody else's" });

    field("project-9");

    expect(screen.getByRole("combobox")).toHaveTextContent("Somebody else's");
  });
});
