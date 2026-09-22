import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import { selectTaskArgumentsForInputs } from "./taskArguments";

const componentSpec: ComponentSpec = {
  inputs: [{ name: "token" }, { name: "region" }],
  implementation: { graph: { tasks: {} } },
};

describe("selectTaskArgumentsForInputs", () => {
  it("keeps current inputs and lets explicit values replace saved values", () => {
    const savedSecret = {
      dynamicData: { secret: { name: "saved-token" } },
    };

    expect(
      selectTaskArgumentsForInputs(
        componentSpec,
        { token: savedSecret, removed: "old" },
        { token: "replacement", region: "ca-central-1" },
      ),
    ).toEqual({ token: "replacement", region: "ca-central-1" });
  });

  it("retains saved dynamic values when no explicit replacement is supplied", () => {
    const savedSystem = {
      dynamicData: { "system/multi_node/node_index": {} },
    };

    expect(
      selectTaskArgumentsForInputs(componentSpec, { token: savedSystem }),
    ).toEqual({ token: savedSystem });
  });
});
