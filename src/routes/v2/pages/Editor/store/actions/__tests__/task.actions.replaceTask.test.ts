import { describe, expect, it, vi } from "vitest";

import { ComponentSpec, Task } from "@/models/componentSpec";
import { replaceTask } from "@/routes/v2/pages/Editor/store/actions/task.actions";
import type { ComponentReference, InputSpec } from "@/utils/componentSpec";

// task.actions imports the editor node registry barrel (used by other actions,
// not by replaceTask). Loading the real barrel pulls in the node manifests and
// trips a module cycle in the test environment, so stub it.
vi.mock("@/routes/v2/pages/Editor/nodes", () => ({
  editorRegistry: { getByNodeId: () => undefined },
}));

const noopUndo = {
  withGroup: <T>(_label: string, fn: () => T): T => fn(),
};

const datasetRef = (
  digest: string,
  inputs: InputSpec[],
): ComponentReference => ({
  name: "Chicago Taxi Trips dataset",
  digest,
  spec: {
    name: "Chicago Taxi Trips dataset",
    inputs,
    outputs: [{ name: "Table" }],
    implementation: {
      container: { image: "alpine/curl", command: ["sh", "-ec", "true"] },
    },
  },
});

const LIMIT_AND_SELECT: InputSpec[] = [
  { name: "Limit", type: "Integer", default: "1000" },
  { name: "Select", type: "String" },
];

const makeSpecWithDataset = () => {
  const spec = new ComponentSpec({ $id: "spec_1", name: "Pipeline" });
  spec.addTask(
    new Task({
      $id: "dataset",
      name: "dataset",
      componentRef: datasetRef("old-digest", LIMIT_AND_SELECT),
      arguments: [
        { name: "Limit", value: "86" },
        { name: "Select", value: "tips,trip_seconds" },
      ],
    }),
  );
  return spec;
};

describe("replaceTask (edit component definition, v2)", () => {
  it("swaps the componentRef in place, keeping task id/name and compatible arguments", () => {
    const spec = makeSpecWithDataset();

    const result = replaceTask(
      noopUndo,
      spec,
      "dataset",
      datasetRef("new-digest", LIMIT_AND_SELECT),
    );

    const task = spec.tasks.find((t) => t.$id === "dataset");

    expect(spec.tasks).toHaveLength(1);
    expect(task?.name).toBe("dataset");
    expect(task?.componentRef.digest).toBe("new-digest");
    expect(task?.arguments.map((a) => a.name).sort()).toEqual([
      "Limit",
      "Select",
    ]);
    expect(result.inputDiff?.lostEntities ?? []).toEqual([]);
  });

  it("drops arguments and reports lostInputs for inputs the edit removed", () => {
    const spec = makeSpecWithDataset();

    const result = replaceTask(
      noopUndo,
      spec,
      "dataset",
      datasetRef("new-digest", [{ name: "Limit", type: "Integer" }]),
    );

    const task = spec.tasks.find((t) => t.$id === "dataset");

    expect((result.inputDiff?.lostEntities ?? []).map((i) => i.name)).toEqual([
      "Select",
    ]);
    expect(task?.arguments.map((a) => a.name)).toEqual(["Limit"]);
  });

  it("adds arguments (with defaults) for inputs the edit introduced", () => {
    const spec = makeSpecWithDataset();

    replaceTask(noopUndo, spec, "dataset", {
      name: "Chicago Taxi Trips dataset",
      digest: "new-digest",
      spec: {
        name: "Chicago Taxi Trips dataset",
        inputs: [
          ...LIMIT_AND_SELECT,
          { name: "Format", type: "String", default: "csv" },
        ],
        outputs: [{ name: "Table" }],
        implementation: { container: { image: "alpine/curl" } },
      },
    });

    const task = spec.tasks.find((t) => t.$id === "dataset");
    const formatArg = task?.arguments.find((a) => a.name === "Format");

    expect(formatArg?.value).toBe("csv");
  });
});
