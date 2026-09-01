import { describe, expect, it } from "vitest";

import {
  ACCELERATORS_ANNOTATION,
  buildLauncherSchemaFromCapabilities,
  CLOUD_PROVIDER_ANNOTATION,
  type LauncherConfig,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/AnnotationsEditor/utils";
import { Binding, ComponentSpec, Input, Task } from "@/models/componentSpec";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

import {
  selectCluster,
  setConditionalExecution,
  setRunCondition,
} from "./taskConfig.actions";

const noopUndo = {
  withGroup: <T>(_label: string, fn: () => T): T => fn(),
};

function makeSpecWithTask() {
  const task = new Task({ $id: "task_1", name: "Greet", componentRef: {} });
  const spec = new ComponentSpec({
    $id: "spec_1",
    name: "Pipeline",
    tasks: [task],
  });
  return { spec, task };
}

describe("setConditionalExecution", () => {
  it("enabling defaults the run condition to the always literal", () => {
    const { spec, task } = makeSpecWithTask();

    setConditionalExecution(noopUndo, spec, task, true);

    expect(task.isEnabled).toBe("true");
  });

  it("disabling clears both the literal and any connected condition", () => {
    const task = new Task({ $id: "task_1", name: "Greet", componentRef: {} });
    const flag = new Input({ $id: "input_1", name: "run_greeting" });
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "Pipeline",
      tasks: [task],
      inputs: [flag],
      bindings: [
        new Binding({
          $id: "binding_1",
          sourceEntityId: flag.$id,
          sourcePortName: "run_greeting",
          targetEntityId: task.$id,
          targetPortName: IS_ENABLED_PORT_NAME,
        }),
      ],
    });

    setConditionalExecution(noopUndo, spec, task, false);

    expect(task.isEnabled).toBeUndefined();
    expect(spec.bindings).toHaveLength(0);
  });

  it("leaves other bindings of the same task alone", () => {
    const task = new Task({ $id: "task_1", name: "Greet", componentRef: {} });
    const name = new Input({ $id: "input_1", name: "name" });
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "Pipeline",
      tasks: [task],
      inputs: [name],
      bindings: [
        new Binding({
          $id: "binding_1",
          sourceEntityId: name.$id,
          sourcePortName: "name",
          targetEntityId: task.$id,
          targetPortName: "name",
        }),
      ],
    });

    setConditionalExecution(noopUndo, spec, task, false);

    expect(spec.bindings).toHaveLength(1);
  });

  it("groups the change for undo", () => {
    const labels: string[] = [];
    const undo = {
      withGroup: <T>(label: string, fn: () => T): T => {
        labels.push(label);
        return fn();
      },
    };
    const { spec, task } = makeSpecWithTask();

    setConditionalExecution(undo, spec, task, true);

    expect(labels).toEqual(["Toggle conditional execution"]);
  });
});

describe("setRunCondition", () => {
  it("writes the chosen literal", () => {
    const { task } = makeSpecWithTask();

    setRunCondition(noopUndo, task, "false");
    expect(task.isEnabled).toBe("false");

    setRunCondition(noopUndo, task, "true");
    expect(task.isEnabled).toBe("true");
  });
});

describe("selectCluster", () => {
  const GPU_FIELD = { annotation: ACCELERATORS_ANNOTATION, label: "GPU" };
  const H200 = {
    product: "NVIDIA-H200",
    succeeded_by: { cluster: "b300", product: "NVIDIA-B300" },
  };

  const schema = buildLauncherSchemaFromCapabilities({
    gke: { resource_fields: [], clusters: { eo9: { label: "us-ce1-eo9" } } },
    nebius: {
      resource_fields: [GPU_FIELD],
      clusters: {
        h200: { accelerators: [H200] },
        b300: { accelerators: [{ product: "NVIDIA-B300" }] },
      },
    },
    acme: {
      label: "Acme",
      resource_fields: [{ ...GPU_FIELD, enum: ["NVIDIA-H200"] }],
    },
    aliases: { nebius: "h200" },
  } as LauncherConfig);

  const cluster = (task: Task) =>
    task.annotations.get(CLOUD_PROVIDER_ANNOTATION);
  const accelerator = (task: Task) =>
    task.annotations.get(ACCELERATORS_ANNOTATION);

  it("does not add a GPU to a task that had none", () => {
    const { task } = makeSpecWithTask();

    selectCluster(noopUndo, task, schema, "acme");

    expect(cluster(task)).toBe("acme");
    expect(accelerator(task)).toBeUndefined();
  });

  it("clears a GPU the selected cluster cannot run", () => {
    const { task } = makeSpecWithTask();
    task.annotations.set(CLOUD_PROVIDER_ANNOTATION, "h200");
    task.annotations.set(
      ACCELERATORS_ANNOTATION,
      JSON.stringify({ "NVIDIA-H200": "2" }),
    );

    selectCluster(noopUndo, task, schema, "eo9");

    expect(cluster(task)).toBe("eo9");
    expect(accelerator(task)).toBeUndefined();
  });

  it("follows the successor declared by the cluster an alias names", () => {
    const { task } = makeSpecWithTask();
    task.annotations.set(CLOUD_PROVIDER_ANNOTATION, "nebius");
    task.annotations.set(
      ACCELERATORS_ANNOTATION,
      JSON.stringify({ "NVIDIA-H200": "2" }),
    );

    selectCluster(noopUndo, task, schema, "b300");

    expect(cluster(task)).toBe("b300");
    expect(accelerator(task)).toBe(JSON.stringify({ "NVIDIA-B300": "2" }));
  });

  it("groups the switch and the clear as one undo step", () => {
    const labels: string[] = [];
    const undo = {
      withGroup: <T>(label: string, fn: () => T): T => {
        labels.push(label);
        return fn();
      },
    };
    const { task } = makeSpecWithTask();
    task.annotations.set(
      ACCELERATORS_ANNOTATION,
      JSON.stringify({ "NVIDIA-H200": "1" }),
    );

    selectCluster(undo, task, schema, "eo9");

    expect(labels).toEqual(["Select cluster"]);
  });
});
