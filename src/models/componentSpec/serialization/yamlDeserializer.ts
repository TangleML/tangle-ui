import { Annotations, deserializeAnnotationValue } from "../annotations";
import { Binding } from "../entities/binding";
import { ComponentSpec } from "../entities/componentSpec";
import { Input } from "../entities/input";
import { Output } from "../entities/output";
import { Task } from "../entities/task";
import type {
  Annotation,
  Argument,
  ArgumentType,
  ComponentSpecJson,
  GraphSpec,
  ImplementationType,
  InputSpec,
  MetadataSpec,
  OutputSpec,
  TaskSpec,
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
    const graph = getGraph(json.implementation);

    const inputs = this.buildInputs(json.inputs);
    const outputs = this.buildOutputs(json.outputs);
    const tasks = this.buildTasks(graph?.tasks);
    const bindings = this.buildBindings(graph, inputs, outputs, tasks);
    const annotations = Annotations.from(
      this.buildMetadataAnnotations(json.metadata),
    );

    return new ComponentSpec({
      $id: this.idGen.next("spec"),
      name: json.name ?? "Untitled",
      description: json.description,
      inputs,
      outputs,
      tasks,
      bindings,
      annotations,
    });
  }

  private buildInputs(inputsJson?: InputSpec[]): Input[] {
    if (!inputsJson) return [];

    return inputsJson.map((inputJson) => {
      const annotationItems: Annotation[] = [];
      if (inputJson.annotations) {
        for (const [key, value] of Object.entries(inputJson.annotations)) {
          annotationItems.push({
            key,
            value: deserializeAnnotationValue(key, value),
          });
        }
      }

      return new Input({
        $id: this.idGen.next("input"),
        name: inputJson.name,
        type: inputJson.type,
        description: inputJson.description,
        defaultValue: inputJson.default,
        optional: inputJson.optional,
        annotations: Annotations.from(annotationItems),
      });
    });
  }

  private buildOutputs(outputsJson?: OutputSpec[]): Output[] {
    if (!outputsJson) return [];

    return outputsJson.map((outputJson) => {
      const annotationItems: Annotation[] = [];
      if (outputJson.annotations) {
        for (const [key, value] of Object.entries(outputJson.annotations)) {
          annotationItems.push({
            key,
            value: deserializeAnnotationValue(key, value),
          });
        }
      }

      return new Output({
        $id: this.idGen.next("output"),
        name: outputJson.name,
        type: outputJson.type,
        description: outputJson.description,
        annotations: Annotations.from(annotationItems),
      });
    });
  }

  private buildTasks(tasksJson?: Record<string, TaskSpec>): Task[] {
    if (!tasksJson) return [];

    return Object.entries(tasksJson).map(([taskName, taskJson]) => {
      const annotationItems: Annotation[] = [];
      if (taskJson.annotations) {
        for (const [key, value] of Object.entries(taskJson.annotations)) {
          annotationItems.push({
            key,
            value: deserializeAnnotationValue(key, value),
          });
        }
      }

      const args: Argument[] = [];
      if (taskJson.arguments) {
        for (const [argName, argValue] of Object.entries(taskJson.arguments)) {
          if (typeof argValue === "string") {
            if (
              !this.isGraphInputReference(argValue) &&
              !this.isTaskOutputReference(argValue)
            ) {
              args.push({ name: argName, value: argValue });
            }
          } else if (!this.isBindingArgument(argValue)) {
            args.push({ name: argName, value: argValue });
          }
        }
      }

      return new Task({
        $id: this.idGen.next("task"),
        name: taskName,
        componentRef: taskJson.componentRef,
        isEnabled: taskJson.isEnabled,
        executionOptions: taskJson.executionOptions,
        annotations: Annotations.from(annotationItems),
        arguments: args,
      });
    });
  }

  private buildBindings(
    graph: GraphSpec | undefined,
    inputs: Input[],
    outputs: Output[],
    tasks: Task[],
  ): Binding[] {
    const bindings: Binding[] = [];
    if (!graph?.tasks) return bindings;

    for (const [taskName, taskJson] of Object.entries(graph.tasks)) {
      const targetTask = tasks.find((t) => t.name === taskName);
      if (!targetTask || !taskJson.arguments) continue;

      for (const [argName, argValue] of Object.entries(taskJson.arguments)) {
        const binding = this.createBindingFromArgument(
          inputs,
          tasks,
          targetTask.$id,
          argName,
          argValue,
        );
        if (binding) bindings.push(binding);
      }
    }

    if (graph.outputValues) {
      for (const [outputName, outputValue] of Object.entries(
        graph.outputValues,
      )) {
        const output = outputs.find((o) => o.name === outputName);
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
          const sourceTask = tasks.find((t) => t.name === taskOutput.taskId);
          if (sourceTask) {
            bindings.push(
              new Binding({
                $id: this.idGen.next("binding"),
                sourceEntityId: sourceTask.$id,
                sourcePortName: taskOutput.outputName,
                targetEntityId: output.$id,
                targetPortName: outputName,
              }),
            );
          }
        }
      }
    }

    return bindings;
  }

  private createBindingFromArgument(
    inputs: Input[],
    tasks: Task[],
    targetEntityId: string,
    targetPortName: string,
    argValue: ArgumentType,
  ): Binding | null {
    if (typeof argValue === "string") {
      const graphInputMatch = argValue.match(GRAPH_INPUT_REGEX);
      if (graphInputMatch) {
        const inputName = graphInputMatch[1];
        const input = inputs.find((i) => i.name === inputName);
        if (input) {
          return new Binding({
            $id: this.idGen.next("binding"),
            sourceEntityId: input.$id,
            sourcePortName: inputName,
            targetEntityId,
            targetPortName,
          });
        }
        return null;
      }

      const taskOutputMatch = argValue.match(TASK_OUTPUT_REGEX);
      if (taskOutputMatch) {
        const taskId = taskOutputMatch[1];
        const outputName = taskOutputMatch[2];
        const sourceTask = tasks.find((t) => t.name === taskId);
        if (sourceTask) {
          return new Binding({
            $id: this.idGen.next("binding"),
            sourceEntityId: sourceTask.$id,
            sourcePortName: outputName,
            targetEntityId,
            targetPortName,
          });
        }
        return null;
      }
    }

    if (typeof argValue === "object" && argValue !== null) {
      if ("graphInput" in argValue) {
        const graphInput = argValue.graphInput;
        const input = inputs.find((i) => i.name === graphInput.inputName);
        if (input) {
          return new Binding({
            $id: this.idGen.next("binding"),
            sourceEntityId: input.$id,
            sourcePortName: graphInput.inputName,
            targetEntityId,
            targetPortName,
          });
        }
      } else if ("taskOutput" in argValue) {
        const taskOutput = argValue.taskOutput;
        const sourceTask = tasks.find((t) => t.name === taskOutput.taskId);
        if (sourceTask) {
          return new Binding({
            $id: this.idGen.next("binding"),
            sourceEntityId: sourceTask.$id,
            sourcePortName: taskOutput.outputName,
            targetEntityId,
            targetPortName,
          });
        }
      }
    }

    return null;
  }

  private buildMetadataAnnotations(metadata?: MetadataSpec): Annotation[] {
    if (!metadata?.annotations) return [];
    return Object.entries(metadata.annotations).map(([key, value]) => ({
      key,
      value: deserializeAnnotationValue(key, value),
    }));
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
