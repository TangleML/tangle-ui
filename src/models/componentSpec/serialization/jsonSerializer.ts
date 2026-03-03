import type { Binding } from "../entities/binding";
import type { ComponentSpec } from "../entities/componentSpec";
import type { Input } from "../entities/input";
import type { Output } from "../entities/output";
import type { Task } from "../entities/task";
import type {
  Annotation,
  Argument,
  ArgumentType,
  ComponentSpecJson,
  GraphSpec,
  InputSpecJson,
  MetadataSpec,
  OutputSpecJson,
  TaskOutputArgument,
  TaskSpecJson,
} from "../entities/types";

export class JsonSerializer {
  serialize(spec: ComponentSpec): ComponentSpecJson {
    const result: ComponentSpecJson = {
      name: spec.name,
      implementation: {
        graph: this.serializeGraph(spec),
      },
    };

    if (spec.description) {
      result.description = spec.description;
    }

    if (spec.inputs.length > 0) {
      result.inputs = spec.inputs.map((i) => this.serializeInput(i));
    }

    if (spec.outputs.length > 0) {
      result.outputs = spec.outputs.map((o) => this.serializeOutput(o));
    }

    const metadata = this.extractMetadata(spec.annotations);
    if (Object.keys(metadata).length > 0) {
      result.metadata = metadata;
    }

    return result;
  }

  private serializeGraph(spec: ComponentSpec): GraphSpec {
    const tasks: Record<string, TaskSpecJson> = {};
    const outputValues: Record<string, TaskOutputArgument> = {};

    for (const task of spec.tasks) {
      tasks[task.name] = this.serializeTask(task, spec);
    }

    for (const output of spec.outputs) {
      const binding = spec.bindings.find(
        (b) => b.targetEntityId === output.$id,
      );
      if (binding) {
        const sourceTask = spec.tasks.find(
          (t) => t.$id === binding.sourceEntityId,
        );
        if (sourceTask) {
          outputValues[output.name] = {
            taskOutput: {
              taskId: sourceTask.name,
              outputName: binding.sourcePortName,
            },
          };
        }
      }
    }

    return {
      tasks,
      ...(Object.keys(outputValues).length > 0 && { outputValues }),
    };
  }

  private serializeTask(task: Task, spec: ComponentSpec): TaskSpecJson {
    const taskBindings = spec.bindings.filter(
      (b) => b.targetEntityId === task.$id,
    );
    const args = this.serializeArguments(task.arguments, taskBindings, spec);

    const result: TaskSpecJson = {
      componentRef: task.componentRef,
    };

    if (Object.keys(args).length > 0) {
      result.arguments = args;
    }

    if (task.isEnabled) {
      result.isEnabled = task.isEnabled;
    }

    const annotations = this.serializeAnnotations(task.annotations);
    if (Object.keys(annotations).length > 0) {
      result.annotations = annotations;
    }

    return result;
  }

  private serializeArguments(
    args: Argument[],
    bindings: Binding[],
    spec: ComponentSpec,
  ): Record<string, ArgumentType> {
    const result: Record<string, ArgumentType> = {};

    for (const binding of bindings) {
      const sourceTask = spec.tasks.find(
        (t) => t.$id === binding.sourceEntityId,
      );
      const sourceInput = spec.inputs.find(
        (i) => i.$id === binding.sourceEntityId,
      );

      if (sourceTask) {
        result[binding.targetPortName] = {
          taskOutput: {
            taskId: sourceTask.name,
            outputName: binding.sourcePortName,
          },
        };
      } else if (sourceInput) {
        result[binding.targetPortName] = {
          graphInput: {
            inputName: sourceInput.name,
          },
        };
      }
    }

    for (const arg of args) {
      if (arg.value !== undefined && !(arg.name in result)) {
        result[arg.name] = arg.value;
      }
    }

    return result;
  }

  private serializeInput(input: Input): InputSpecJson {
    const result: InputSpecJson = {
      name: input.name,
    };

    if (input.type) result.type = input.type;
    if (input.description) result.description = input.description;
    if (input.defaultValue) result.default = input.defaultValue;
    if (input.optional !== undefined) result.optional = input.optional;

    const annotations = this.serializeAnnotations(input.annotations);
    if (Object.keys(annotations).length > 0) {
      result.annotations = annotations;
    }

    return result;
  }

  private serializeOutput(output: Output): OutputSpecJson {
    const result: OutputSpecJson = {
      name: output.name,
    };

    if (output.type) result.type = output.type;
    if (output.description) result.description = output.description;

    const annotations = this.serializeAnnotations(output.annotations);
    if (Object.keys(annotations).length > 0) {
      result.annotations = annotations;
    }

    return result;
  }

  private serializeAnnotations(
    annotations: Annotation[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const annotation of annotations) {
      if (!annotation.key.startsWith("metadata.")) {
        result[annotation.key] = annotation.value;
      }
    }
    return result;
  }

  private extractMetadata(annotations: Annotation[]): MetadataSpec {
    const metadata: MetadataSpec = {};
    for (const annotation of annotations) {
      if (annotation.key.startsWith("metadata.")) {
        const key = annotation.key.slice("metadata.".length);
        metadata[key] = annotation.value;
      }
    }
    return metadata;
  }
}
