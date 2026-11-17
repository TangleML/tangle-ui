import type { Node } from "@xyflow/react";
import { describe, expect, test } from "vitest";

import {
  type ComponentSpec,
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { EDITOR_COLLAPSED_ANNOTATION } from "@/utils/annotations";

import {
  estimateFullCardSize,
  estimateIONodeCardSize,
  estimateTaskCardSize,
} from "./estimateFullCardSize";

const portNames = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({ name: `${prefix}_${index}` }));

const deserialize = (
  inputCount: number,
  outputCount: number,
  {
    taskName = "Train",
    annotations = {},
  }: { taskName?: string; annotations?: Record<string, string> } = {},
): ComponentSpec =>
  new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Pipeline",
    inputs: [{ name: "dataset", description: "Raw rows" }],
    outputs: [{ name: "model" }],
    implementation: {
      graph: {
        tasks: {
          [taskName]: {
            annotations,
            arguments:
              inputCount > 0
                ? { in_0: { graphInput: { inputName: "dataset" } } }
                : {},
            componentRef: {
              spec: {
                name: "Trainer",
                inputs: portNames("in", inputCount),
                outputs: portNames("out", outputCount),
                implementation: { container: { image: "trainer" } },
              },
            },
          },
        },
        outputValues: {},
      },
    },
  });

const taskSize = (spec: ComponentSpec) =>
  estimateTaskCardSize(spec.tasks[0], spec);

describe("estimateTaskCardSize", () => {
  test("sums the frame, title, input rows and output rows of the full card", () => {
    expect(taskSize(deserialize(3, 1))).toEqual({ width: 350, height: 232 });
  });

  test("grows by one row and one row gap per input", () => {
    const threeInputs = taskSize(deserialize(3, 1)).height;
    const fourInputs = taskSize(deserialize(4, 1)).height;

    expect(fourInputs - threeInputs).toBe(36);
  });

  test("adds a title line for each wrap of a long task name", () => {
    const shortName = taskSize(deserialize(3, 1)).height;
    const longName = taskSize(
      deserialize(3, 1, { taskName: "x".repeat(61) }),
    ).height;

    expect(longName - shortName).toBe(32);
  });

  test("counts only connected inputs and one output row on a collapsed card", () => {
    const collapsed = taskSize(
      deserialize(20, 5, {
        annotations: { [EDITOR_COLLAPSED_ANNOTATION]: "true" },
      }),
    );

    expect(collapsed.height).toBe(taskSize(deserialize(1, 1)).height);
  });
});

describe("estimateIONodeCardSize", () => {
  test("sizes a card with a one-line name", () => {
    expect(estimateIONodeCardSize({ name: "dataset" })).toEqual({
      width: 240,
      height: 172,
    });
  });

  test("makes room for a description line", () => {
    expect(
      estimateIONodeCardSize({ name: "dataset", description: "Raw rows" })
        .height,
    ).toBe(194);
  });
});

describe("estimateFullCardSize", () => {
  const spec = deserialize(3, 1);
  const nodeFor = (id: string, type: string): Node => ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: {},
  });

  test("estimates task, input and output nodes from the spec", () => {
    expect(
      estimateFullCardSize(nodeFor(spec.tasks[0].$id, "task"), spec),
    ).toEqual(taskSize(spec));
    expect(
      estimateFullCardSize(nodeFor(spec.inputs[0].$id, "input"), spec),
    ).toEqual(estimateIONodeCardSize(spec.inputs[0]));
    expect(
      estimateFullCardSize(nodeFor(spec.outputs[0].$id, "output"), spec),
    ).toEqual(estimateIONodeCardSize(spec.outputs[0]));
  });

  test("leaves other nodes and unknown entities to their measured size", () => {
    expect(estimateFullCardSize(nodeFor("note", "flex"), spec)).toBeUndefined();
    expect(
      estimateFullCardSize(nodeFor("missing", "task"), spec),
    ).toBeUndefined();
  });
});
