import { proxy } from "valtio";

import {
  hydrateComponentReference,
  parseComponentData,
} from "@/services/componentService";
import {
  type ComponentSpec,
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
  type TaskSpec,
} from "@/utils/componentSpec";

import { ComponentSpecEntity } from "./componentSpec";
import { type Context, RootContext } from "./context";
import { GraphImplementation } from "./graphImplementation";
import type { TaskEntity } from "./tasks";

export class YamlLoader {
  private readonly rootContext: Context;

  constructor() {
    this.rootContext = new RootContext();
  }

  async loadFromText(text: string): Promise<ComponentSpecEntity> {
    const loadedSpec = parseComponentData(text);
    if (!loadedSpec) {
      throw new Error("Failed to load component data");
    }

    return this.load(
      loadedSpec,
      loadedSpec.name ?? "Root Spec",
      this.rootContext,
    );
  }

  async load(
    loadedSpec: ComponentSpec,
    name: string,
    parentContext: Context,
  ): Promise<ComponentSpecEntity> {
    // Wrap root entity with proxy() to ensure Valtio tracks mutations
    const rootSpecEntity = proxy(
      new ComponentSpecEntity(parentContext.generateId(), parentContext, {
        name,
      }),
    ).populate({
      name,
      description: loadedSpec.description,
    });

    parentContext.registerEntity(rootSpecEntity);

    for (const input of loadedSpec.inputs ?? []) {
      rootSpecEntity.inputs.add({
        name: input.name,
        type: input.type,
        description: input.description,
      });
    }

    for (const output of loadedSpec.outputs ?? []) {
      rootSpecEntity.outputs.add({
        name: output.name,
        type: output.type,
        description: output.description,
      });
    }

    if (isGraphImplementation(loadedSpec.implementation)) {
      const queue: {
        taskEntity: TaskEntity;
        taskId: string;
        taskSpec: TaskSpec;
      }[] = [];

      // Wrap GraphImplementation with proxy() to ensure Valtio tracks mutations
      const graphImplementation = proxy(
        new GraphImplementation(rootSpecEntity),
      );
      rootSpecEntity.implementation = graphImplementation;

      for (const [taskId, task] of Object.entries(
        loadedSpec.implementation.graph.tasks,
      )) {
        const hydratedComponentRef = await hydrateComponentReference(
          task.componentRef,
        );

        if (!hydratedComponentRef) {
          throw new Error(
            `Failed to hydrate component reference for task ${taskId}`,
          );
        }

        const taskEntity = graphImplementation.tasks.add({
          name: taskId,
          componentRef: hydratedComponentRef,
        });

        queue.push({ taskEntity, taskId, taskSpec: task });

        await this.load(hydratedComponentRef.spec, taskId, rootSpecEntity);
      }

      // dequeue tasks and create connections
      while (queue.length > 0) {
        const { taskEntity, taskId, taskSpec } = queue.shift()!;

        // options
        taskEntity.populate({
          ...taskSpec,
          name: taskId,
        });

        for (const [argumentName, argumentValue] of Object.entries(
          taskSpec.arguments ?? {},
        )) {
          // Create argument entity for all arguments (including connected ones)
          // This ensures the argument exists for serialization
          const argumentEntity = taskEntity.arguments.add({
            name: argumentName,
          });

          if (isGraphInputArgument(argumentValue)) {
            // GraphInput argument - create binding
            const inputResult = rootSpecEntity.inputs.findByIndex(
              "name",
              argumentValue.graphInput.inputName,
            );
            if (inputResult.length !== 1) {
              throw new Error(
                `Multiple inputs found for ${argumentValue.graphInput.inputName}`,
              );
            }

            graphImplementation.bindings.bind(
              {
                entityId: inputResult[0].$id,
                portName: inputResult[0].name,
              },
              {
                entityId: taskEntity.$id,
                portName: argumentName,
              },
            );
          } else if (isTaskOutputArgument(argumentValue)) {
            // TaskOutput argument - create binding
            const taskResult = graphImplementation.tasks.findByIndex(
              "name",
              argumentValue.taskOutput.taskId,
            );
            if (taskResult.length !== 1) {
              throw new Error(
                `Multiple tasks found for ${argumentValue.taskOutput.taskId}`,
              );
            }

            graphImplementation.bindings.bind(
              {
                entityId: taskResult[0].$id,
                portName: argumentValue.taskOutput.outputName,
              },
              {
                entityId: taskEntity.$id,
                portName: argumentName,
              },
            );
          } else {
            // Literal value
            argumentEntity.value = argumentValue;
          }
        }
      }

      // Load outputValues (task output → graph output bindings)
      const outputValues = loadedSpec.implementation.graph.outputValues ?? {};
      for (const [graphOutputName, outputValue] of Object.entries(
        outputValues,
      )) {
        if (isTaskOutputArgument(outputValue)) {
          const sourceTask = graphImplementation.tasks.findByIndex(
            "name",
            outputValue.taskOutput.taskId,
          )[0];
          const targetOutput = rootSpecEntity.outputs.findByIndex(
            "name",
            graphOutputName,
          )[0];

          if (sourceTask && targetOutput) {
            graphImplementation.bindings.bind(
              {
                entityId: sourceTask.$id,
                portName: outputValue.taskOutput.outputName,
              },
              {
                entityId: targetOutput.$id,
                portName: graphOutputName,
              },
            );
          }
        }
      }
    } else {
      // todo: handle other implementation types
    }

    return rootSpecEntity;
  }
}
