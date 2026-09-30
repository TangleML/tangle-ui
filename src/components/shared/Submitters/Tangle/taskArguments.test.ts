import { describe, expect, it } from "vitest";

import type { ComponentSpec, DynamicDataArgument } from "@/utils/componentSpec";

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

  it.each<DynamicDataArgument>([
    { dynamicData: { secret: { name: "saved-token" } } },
    { dynamicData: { "system/multi_node/node_index": {} } },
  ])("uses edits made before autosave in place of %j", (savedArgument) => {
    const editedSpec: ComponentSpec = {
      ...componentSpec,
      inputs: [
        { name: "token", value: "current literal", default: "fallback" },
        { name: "region", value: "" },
      ],
    };

    expect(
      selectTaskArgumentsForInputs(editedSpec, {
        token: savedArgument,
        region: savedArgument,
      }),
    ).toEqual({ token: "current literal", region: "" });

    expect(
      selectTaskArgumentsForInputs(
        editedSpec,
        { token: savedArgument },
        { token: "run override" },
      ),
    ).toEqual({ token: "run override", region: "" });
  });

  it("uses saved dynamic arguments ahead of defaults and drops deleted inputs", () => {
    const savedSecret = { dynamicData: { secret: { name: "saved-token" } } };
    const spec: ComponentSpec = {
      ...componentSpec,
      inputs: [
        { name: "token", default: "fallback" },
        { name: "region", default: "us-east-1" },
      ],
    };

    expect(
      selectTaskArgumentsForInputs(spec, {
        token: savedSecret,
        deleted: savedSecret,
      }),
    ).toEqual({ token: savedSecret, region: "us-east-1" });
  });
});
