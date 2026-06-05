import { describe, expect, it } from "vitest";

import type { ComponentReference, GraphSpec } from "@/utils/componentSpec";

import { replaceTaskComponentRef } from "./replaceTaskComponentRef";

const taxiRef = (command: string): ComponentReference => ({
  name: "Chicago Taxi Trips dataset",
  digest: "old-digest",
  spec: {
    name: "Chicago Taxi Trips dataset",
    inputs: [
      { name: "Limit", type: "Integer", default: "1000" },
      { name: "Select", type: "String" },
    ],
    outputs: [{ name: "Table" }],
    implementation: { container: { image: "alpine/curl", command: [command] } },
  },
});

const baseGraphSpec = (): GraphSpec => ({
  tasks: {
    dataset: {
      componentRef: taxiRef("sed -E 's/x/'\\1'/g'"),
      annotations: { "editor.position": '{"x":10,"y":20}' },
      arguments: {
        Limit: { graphInput: { inputName: "Input" } },
        Select: "tips,trip_seconds",
      },
    },
    train: {
      componentRef: { name: "Train" },
      arguments: {
        training_data: {
          taskOutput: { taskId: "dataset", outputName: "Table" },
        },
      },
    },
  },
});

describe("replaceTaskComponentRef", () => {
  it("swaps the componentRef in place without renaming the task", () => {
    const graphSpec = baseGraphSpec();
    const fixedRef: ComponentReference = {
      ...taxiRef("sed -E 's/x/\\1/g'"),
      digest: "new-digest",
    };

    const { updatedGraphSpec, lostInputs } = replaceTaskComponentRef(
      "dataset",
      fixedRef,
      graphSpec,
    );

    // Same key, no "dataset 2".
    expect(Object.keys(updatedGraphSpec.tasks)).toEqual(["dataset", "train"]);
    expect(updatedGraphSpec.tasks.dataset.componentRef.digest).toBe(
      "new-digest",
    );
    expect(lostInputs).toEqual([]);
  });

  it("preserves the task's arguments, annotations and downstream wiring", () => {
    const graphSpec = baseGraphSpec();
    const fixedRef = { ...taxiRef("fixed"), digest: "new-digest" };

    const { updatedGraphSpec } = replaceTaskComponentRef(
      "dataset",
      fixedRef,
      graphSpec,
    );

    expect(updatedGraphSpec.tasks.dataset.arguments).toEqual({
      Limit: { graphInput: { inputName: "Input" } },
      Select: "tips,trip_seconds",
    });
    expect(updatedGraphSpec.tasks.dataset.annotations).toEqual({
      "editor.position": '{"x":10,"y":20}',
    });
    // Downstream consumer still wired to the (unchanged) output/taskId.
    expect(updatedGraphSpec.tasks.train.arguments).toEqual({
      training_data: {
        taskOutput: { taskId: "dataset", outputName: "Table" },
      },
    });
  });

  it("does not mutate the original graph spec", () => {
    const graphSpec = baseGraphSpec();
    const fixedRef = { ...taxiRef("fixed"), digest: "new-digest" };

    replaceTaskComponentRef("dataset", fixedRef, graphSpec);

    expect(graphSpec.tasks.dataset.componentRef.digest).toBe("old-digest");
  });

  it("drops arguments for inputs the edited component no longer defines", () => {
    const graphSpec = baseGraphSpec();
    const refWithoutSelect: ComponentReference = {
      name: "Chicago Taxi Trips dataset",
      digest: "new-digest",
      spec: {
        name: "Chicago Taxi Trips dataset",
        inputs: [{ name: "Limit", type: "Integer" }],
        outputs: [{ name: "Table" }],
        implementation: { container: { image: "alpine/curl" } },
      },
    };

    const { updatedGraphSpec, lostInputs } = replaceTaskComponentRef(
      "dataset",
      refWithoutSelect,
      graphSpec,
    );

    expect(lostInputs.map((input) => input.name)).toEqual(["Select"]);
    expect(updatedGraphSpec.tasks.dataset.arguments).toEqual({
      Limit: { graphInput: { inputName: "Input" } },
    });
  });

  it("drops downstream bindings to outputs the edited component no longer produces", () => {
    const graphSpec = baseGraphSpec();
    const refWithoutTable: ComponentReference = {
      name: "Chicago Taxi Trips dataset",
      digest: "new-digest",
      spec: {
        name: "Chicago Taxi Trips dataset",
        inputs: [
          { name: "Limit", type: "Integer" },
          { name: "Select", type: "String" },
        ],
        outputs: [{ name: "RenamedTable" }],
        implementation: { container: { image: "alpine/curl" } },
      },
    };

    const { updatedGraphSpec } = replaceTaskComponentRef(
      "dataset",
      refWithoutTable,
      graphSpec,
    );

    expect(updatedGraphSpec.tasks.train.arguments).toEqual({});
  });

  it("seeds default arguments for newly added inputs", () => {
    const graphSpec = baseGraphSpec();
    const refWithNewInput: ComponentReference = {
      name: "Chicago Taxi Trips dataset",
      digest: "new-digest",
      spec: {
        name: "Chicago Taxi Trips dataset",
        inputs: [
          { name: "Limit", type: "Integer", default: "1000" },
          { name: "Select", type: "String" },
          { name: "Format", type: "String", default: "csv" },
          { name: "NoDefault", type: "String" },
        ],
        outputs: [{ name: "Table" }],
        implementation: { container: { image: "alpine/curl" } },
      },
    };

    const { updatedGraphSpec } = replaceTaskComponentRef(
      "dataset",
      refWithNewInput,
      graphSpec,
    );

    // New input with a default is seeded; one without a default is not; and
    // existing arguments are preserved.
    expect(updatedGraphSpec.tasks.dataset.arguments).toEqual({
      Limit: { graphInput: { inputName: "Input" } },
      Select: "tips,trip_seconds",
      Format: "csv",
    });
  });

  it("returns the graph unchanged when the task does not exist", () => {
    const graphSpec = baseGraphSpec();
    const fixedRef = { ...taxiRef("fixed"), digest: "new-digest" };

    const { updatedGraphSpec, lostInputs } = replaceTaskComponentRef(
      "missing",
      fixedRef,
      graphSpec,
    );

    expect(lostInputs).toEqual([]);
    expect(updatedGraphSpec.tasks.dataset.componentRef.digest).toBe(
      "old-digest",
    );
  });
});
