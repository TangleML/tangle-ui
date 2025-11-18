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
import { GraphImplementation, TaskEntity } from "./graphImplementation";

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
    const rootSpecEntity = new ComponentSpecEntity(
      parentContext.generateId(),
      parentContext,
      { name },
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

      // todo: use context
      const graphImplementation = new GraphImplementation(rootSpecEntity);
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
          const argumentEntity = taskEntity.arguments.add({
            name: argumentName,
          });

          if (isGraphInputArgument(argumentValue)) {
            const inputResult = rootSpecEntity.inputs.findByIndex(
              "name",
              argumentValue.graphInput.inputName,
            );
            if (inputResult.length !== 1) {
              throw new Error(
                `Multiple inputs found for ${argumentValue.graphInput.inputName}`,
              );
            }
            argumentEntity.connectTo(inputResult[0]);
          } else if (isTaskOutputArgument(argumentValue)) {
            const taskResult = graphImplementation.tasks.findByIndex(
              "name",
              argumentValue.taskOutput.taskId,
            );
            if (taskResult.length !== 1) {
              throw new Error(
                `Multiple tasks found for ${argumentValue.taskOutput.taskId}`,
              );
            }

            const sourceComponentSpec = rootSpecEntity.findComponentSpecEntity(
              argumentValue.taskOutput.taskId,
            );
            if (!sourceComponentSpec) {
              throw new Error(
                `Source component spec entity not found for ${argumentValue.taskOutput.taskId}`,
              );
            }

            const outputResult = sourceComponentSpec.outputs.findByIndex(
              "name",
              argumentValue.taskOutput.outputName,
            );

            if (outputResult.length !== 1) {
              throw new Error(
                `Multiple outputs found for ${argumentValue.taskOutput.outputName}`,
              );
            }

            argumentEntity.connectTo(outputResult[0]);
          } else {
            argumentEntity.value = argumentValue;
          }
        }
      }
    } else {
      // todo: handle other implementation types
    }

    return rootSpecEntity;
  }
}
