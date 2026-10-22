import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import PipelineIO from "./PipelineIO";

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

afterEach(cleanup);

const componentSpec: ComponentSpec = {
  name: "Example",
  inputs: [{ name: "prompt", type: "String", default: "default prompt" }],
  outputs: [{ name: "result", type: "String" }],
  implementation: {
    graph: {
      tasks: {
        generate: {
          componentRef: {
            spec: {
              outputs: [{ name: "text", type: "String" }],
              implementation: { container: { image: "example" } },
            },
          },
        },
      },
      outputValues: {
        result: { taskOutput: { taskId: "generate", outputName: "text" } },
      },
    },
  },
};

describe("PipelineIO", () => {
  it("renders execution arguments and connected outputs without editor providers", () => {
    render(
      <PipelineIO
        componentSpec={componentSpec}
        taskArguments={{ prompt: "run prompt" }}
      />,
    );

    expect(screen.getByText("run prompt")).toBeInTheDocument();
    expect(screen.queryByText("default prompt")).not.toBeInTheDocument();
    expect(screen.getByText("result")).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the input section independent of output rendering", () => {
    render(<PipelineIO componentSpec={componentSpec} section="inputs" />);

    expect(screen.getByText("default prompt")).toBeInTheDocument();
    expect(screen.queryByText("result")).not.toBeInTheDocument();
  });
});
