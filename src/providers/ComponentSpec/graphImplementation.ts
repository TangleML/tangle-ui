/**
 * GraphImplementation - orchestrates tasks and bindings in a pipeline graph.
 *
 * This is a thin orchestrator that:
 * - Creates TasksCollection and BindingsCollection
 * - Provides a unified lazy GraphContext to all entities
 * - Wires up reactive cleanup for bindings
 */

import { proxy, ref } from "valtio";

import type {
  GraphImplementation as GraphImplementationType,
  TaskOutputArgument,
} from "@/utils/componentSpec";

import { BindingsCollection } from "./bindings";
import type { Context } from "./context";
import type { InputsCollection } from "./inputs";
import type { OutputsCollection } from "./outputs";
import { TasksCollection } from "./tasks";
import type { GraphContext, SerializableEntity } from "./types";

/**
 * Context required from parent (ComponentSpecEntity).
 */
interface GraphImplementationParentContext extends Context {
  inputs: InputsCollection;
  outputs: OutputsCollection;
}

/**
 * GraphImplementation manages the graph-based implementation of a component.
 *
 * Creates a single unified GraphContext with lazy getters that is shared
 * by all entities (TaskEntity, BindingEntity) for accessing collections.
 */
export class GraphImplementation implements SerializableEntity {
  readonly tasks: TasksCollection;
  readonly bindings: BindingsCollection;

  constructor(
    private readonly parentContext: GraphImplementationParentContext,
  ) {
    // Capture `this` for use in lazy getters
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Create a single lazy context with getters - shared by all entities
    // Getters defer property access until collections are fully initialized
    const graphContext: GraphContext = ref({
      // Delegate Context methods to parent
      get $name() {
        return parentContext.$name;
      },
      generateId() {
        return parentContext.generateId();
      },
      registerEntity(entity) {
        parentContext.registerEntity(entity);
      },
      removeEntity(entity) {
        parentContext.removeEntity(entity);
      },

      // Collection accessors - lazy getters for deferred access
      get inputs() {
        return parentContext.inputs;
      },
      get outputs() {
        return parentContext.outputs;
      },
      get tasks() {
        return self.tasks;
      },
      get bindings() {
        return self.bindings;
      },
    });

    // Wrap collections with proxy() to ensure Valtio tracks mutations
    this.tasks = proxy(new TasksCollection(parentContext, graphContext));
    this.bindings = proxy(new BindingsCollection(parentContext, graphContext));

    // Wire up reactive cleanup for bindings
    // When entities are deleted, bindings referencing them are auto-removed
    this.bindings.watchCollection(parentContext.inputs, "source");
    this.bindings.watchCollection(parentContext.outputs, "target");
    this.bindings.watchCollection(this.tasks, "both");
  }

  /**
   * Serializes to schema-compliant GraphImplementation format.
   */
  toJson(): GraphImplementationType {
    const json: GraphImplementationType = {
      graph: {
        tasks: this.tasks.toJson(),
      },
    };

    // Build outputValues from bindings where target is a graph output
    const outputValueBindings = this.bindings
      .getAll()
      .filter((b) => b.bindingType === "outputValue");

    if (outputValueBindings.length > 0) {
      const outputValues: Record<string, TaskOutputArgument> = {};

      for (const binding of outputValueBindings) {
        // Find the source task name by $id
        const sourceTask = this.tasks.findById(binding.sourceEntityId);
        // Look up the actual output entity to get its current name (in case it was renamed)
        const targetOutput = this.parentContext.outputs.findById(
          binding.targetEntityId,
        );

        if (sourceTask && targetOutput) {
          // Use targetOutput.name (current name) instead of binding.targetPortName (name at bind-time)
          outputValues[targetOutput.name] = {
            taskOutput: {
              taskId: sourceTask.name,
              outputName: binding.sourcePortName,
            },
          };
        }
      }

      if (Object.keys(outputValues).length > 0) {
        json.graph.outputValues = outputValues;
      }
    }

    return json;
  }
}
