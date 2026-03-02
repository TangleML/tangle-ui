import { Binding } from "../entities/binding";
import { ComponentSpec } from "../entities/componentSpec";
import { Input } from "../entities/input";
import { Output } from "../entities/output";
import { Task } from "../entities/task";
import type {
  ArgumentType,
  ComponentSpecJson,
  GraphSpec,
  ImplementationType,
  InputSpecJson,
  OutputSpecJson,
  TaskSpecJson,
} from "../entities/types";
import type { IdGenerator } from "../factories/idGenerator";

const GRAPH_INPUT_REGEX = /^\{\{inputs\.([^}]+)\}\}$/;
const TASK_OUTPUT_REGEX = /^\{\{tasks\.([^.]+)\.outputs\.([^}]+)\}\}$/;

function getGraph(implementation?: ImplementationType): GraphSpec | undefined {
  if (!implementation) return undefined;
  if ("graph" in implementation) {
    return implementation.graph;
  }
  return undefined;
}

export class YamlDeserializer {
  constructor(private idGen: IdGenerator) {}

  deserialize(data: unknown): ComponentSpec {
    const json = data as ComponentSpecJson;
    const spec = new ComponentSpec(
      this.idGen.next("spec"),
      json.name ?? "Untitled",
    );

    if (json.description) {
      spec.description = json.description;
    }

    const graph = getGraph(json.implementation);
    this.populateInputs(spec, json.inputs);
    this.populateOutputs(spec, json.outputs);
    this.populateTasks(spec, graph?.tasks);
    this.populateBindings(spec, graph);
    this.populateMetadata(spec, json.metadata);

    return spec;
  }

  private populateInputs(spec: ComponentSpec, inputs?: InputSpecJson[]): void {
    if (!inputs) return;

    for (const inputJson of inputs) {
      const input = new Input(this.idGen.next("input"), {
        name: inputJson.name,
        type: inputJson.type,
        description: inputJson.description,
        defaultValue: inputJson.default,
        optional: inputJson.optional,
      });

      if (inputJson.annotations) {
        for (const [key, value] of Object.entries(inputJson.annotations)) {
          input.annotations.add({ key, value });
        }
      }

      spec.inputs.add(input);
    }
  }

  private populateOutputs(
    spec: ComponentSpec,
    outputs?: OutputSpecJson[],
  ): void {
    if (!outputs) return;

    for (const outputJson of outputs) {
      const output = new Output(this.idGen.next("output"), {
        name: outputJson.name,
        type: outputJson.type,
        description: outputJson.description,
      });

      if (outputJson.annotations) {
        for (const [key, value] of Object.entries(outputJson.annotations)) {
          output.annotations.add({ key, value });
        }
      }

      spec.outputs.add(output);
    }
  }

  private populateTasks(
    spec: ComponentSpec,
    tasks?: Record<string, TaskSpecJson>,
  ): void {
    if (!tasks) return;

    for (const [taskName, taskJson] of Object.entries(tasks)) {
      const task = new Task(this.idGen.next("task"), {
        name: taskName,
        componentRef: taskJson.componentRef,
        isEnabled: taskJson.isEnabled,
      });

      if (taskJson.annotations) {
        for (const [key, value] of Object.entries(taskJson.annotations)) {
          task.annotations.add({ key, value });
        }
      }

      if (taskJson.arguments) {
        for (const [argName, argValue] of Object.entries(taskJson.arguments)) {
          if (typeof argValue === "string") {
            if (
              !this.isGraphInputReference(argValue) &&
              !this.isTaskOutputReference(argValue)
            ) {
              task.arguments.add({ name: argName, value: argValue });
            }
          } else if (!this.isBindingArgument(argValue)) {
            task.arguments.add({ name: argName, value: argValue });
          }
        }
      }

      spec.tasks.add(task);
    }
  }

  private populateBindings(spec: ComponentSpec, graph?: GraphSpec): void {
    if (!graph?.tasks) return;

    for (const [taskName, taskJson] of Object.entries(graph.tasks)) {
      const targetTask = spec.tasks.find((t) => t.name === taskName);
      if (!targetTask || !taskJson.arguments) continue;

      for (const [argName, argValue] of Object.entries(taskJson.arguments)) {
        this.createBindingFromArgument(spec, targetTask.$id, argName, argValue);
      }
    }

    if (graph.outputValues) {
      for (const [outputName, outputValue] of Object.entries(
        graph.outputValues,
      )) {
        const output = spec.outputs.find((o) => o.name === outputName);
        if (!output) continue;

        if (
          typeof outputValue === "object" &&
          outputValue !== null &&
          "taskOutput" in outputValue
        ) {
          const taskOutput = (
            outputValue as {
              taskOutput: { taskId: string; outputName: string };
            }
          ).taskOutput;
          const sourceTask = spec.tasks.find(
            (t) => t.name === taskOutput.taskId,
          );
          if (sourceTask) {
            spec.bindings.add(
              new Binding(this.idGen.next("binding"), {
                source: {
                  entityId: sourceTask.$id,
                  portName: taskOutput.outputName,
                },
                target: { entityId: output.$id, portName: outputName },
              }),
            );
          }
        }
      }
    }
  }

  private createBindingFromArgument(
    spec: ComponentSpec,
    targetEntityId: string,
    targetPortName: string,
    argValue: ArgumentType,
  ): void {
    if (typeof argValue === "string") {
      const graphInputMatch = argValue.match(GRAPH_INPUT_REGEX);
      if (graphInputMatch) {
        const inputName = graphInputMatch[1];
        const input = spec.inputs.find((i) => i.name === inputName);
        if (input) {
          spec.bindings.add(
            new Binding(this.idGen.next("binding"), {
              source: { entityId: input.$id, portName: inputName },
              target: { entityId: targetEntityId, portName: targetPortName },
            }),
          );
        }
        return;
      }

      const taskOutputMatch = argValue.match(TASK_OUTPUT_REGEX);
      if (taskOutputMatch) {
        const taskId = taskOutputMatch[1];
        const outputName = taskOutputMatch[2];
        const sourceTask = spec.tasks.find((t) => t.name === taskId);
        if (sourceTask) {
          spec.bindings.add(
            new Binding(this.idGen.next("binding"), {
              source: { entityId: sourceTask.$id, portName: outputName },
              target: { entityId: targetEntityId, portName: targetPortName },
            }),
          );
        }
        return;
      }
    }

    if (typeof argValue === "object" && argValue !== null) {
      if ("graphInput" in argValue) {
        const graphInput = argValue.graphInput;
        const input = spec.inputs.find((i) => i.name === graphInput.inputName);
        if (input) {
          spec.bindings.add(
            new Binding(this.idGen.next("binding"), {
              source: { entityId: input.$id, portName: graphInput.inputName },
              target: { entityId: targetEntityId, portName: targetPortName },
            }),
          );
        }
      } else if ("taskOutput" in argValue) {
        const taskOutput = argValue.taskOutput;
        const sourceTask = spec.tasks.find((t) => t.name === taskOutput.taskId);
        if (sourceTask) {
          spec.bindings.add(
            new Binding(this.idGen.next("binding"), {
              source: {
                entityId: sourceTask.$id,
                portName: taskOutput.outputName,
              },
              target: { entityId: targetEntityId, portName: targetPortName },
            }),
          );
        }
      }
    }
  }

  private populateMetadata(
    spec: ComponentSpec,
    metadata?: Record<string, unknown>,
  ): void {
    if (!metadata) return;

    for (const [key, value] of Object.entries(metadata)) {
      spec.annotations.add({ key: `metadata.${key}`, value });
    }
  }

  private isGraphInputReference(value: string): boolean {
    return GRAPH_INPUT_REGEX.test(value);
  }

  private isTaskOutputReference(value: string): boolean {
    return TASK_OUTPUT_REGEX.test(value);
  }

  private isBindingArgument(arg: ArgumentType): boolean {
    if (typeof arg === "string") {
      return this.isGraphInputReference(arg) || this.isTaskOutputReference(arg);
    }
    if (typeof arg === "object" && arg !== null) {
      return "graphInput" in arg || "taskOutput" in arg;
    }
    return false;
  }
}
