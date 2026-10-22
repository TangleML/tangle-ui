import { describe, expect, it } from "vitest";

import {
  ComponentSpec,
  serializeComponentSpec,
  Task,
} from "@/models/componentSpec";
import {
  createSubgraph,
  updateRunNameTemplate,
} from "@/routes/v2/pages/Editor/store/actions/pipeline.actions";
import {
  EDITOR_POSITION_ANNOTATION,
  RUN_NAME_TEMPLATE_ANNOTATION,
} from "@/utils/annotations";

const noopUndo = {
  withGroup: <T>(_label: string, fn: () => T): T => fn(),
};

const makeSpec = () => new ComponentSpec({ $id: "spec_1", name: "Pipeline" });

it("groups tasks at their current document positions without selection snapshots", () => {
  const spec = new ComponentSpec({
    name: "Pipeline",
    tasks: ["one", "two"].map(
      (name) => new Task({ $id: name, name, componentRef: {} }),
    ),
  });
  spec.updateNodePosition("one", { x: 400, y: 200 });
  spec.updateNodePosition("two", { x: 800, y: 400 });
  const grouped = createSubgraph(noopUndo, spec, ["one", "two"], "Group");
  expect(grouped?.annotations.get(EDITOR_POSITION_ANNOTATION)).toEqual({
    x: 600,
    y: 300,
  });
});

describe("updateRunNameTemplate", () => {
  it("stores the template so it survives serialization to the wire spec", () => {
    const spec = makeSpec();

    updateRunNameTemplate(noopUndo, spec, "${arguments.dataset}-run");

    expect(spec.annotations.get(RUN_NAME_TEMPLATE_ANNOTATION)).toBe(
      "${arguments.dataset}-run",
    );
    expect(
      serializeComponentSpec(spec).metadata?.annotations?.[
        RUN_NAME_TEMPLATE_ANNOTATION
      ],
    ).toBe("${arguments.dataset}-run");
  });

  it("removes the annotation when the template is cleared", () => {
    const spec = makeSpec();
    updateRunNameTemplate(noopUndo, spec, "${date.timestamp}");

    updateRunNameTemplate(noopUndo, spec, undefined);

    expect(spec.annotations.has(RUN_NAME_TEMPLATE_ANNOTATION)).toBe(false);
    expect(spec.annotations.get(RUN_NAME_TEMPLATE_ANNOTATION)).toBe("");
  });
});
