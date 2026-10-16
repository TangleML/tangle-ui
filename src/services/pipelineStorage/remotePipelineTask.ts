import type {
  ComponentReference,
  ComponentSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

type EmbeddedTask = TaskSpec & { componentRef: { spec: ComponentSpec } };

function normalizeTask(task: TaskSpec): TaskSpec {
  // Local library records also carry UI and storage metadata. Send only the
  // component reference fields accepted by the backend, even without a spec.
  const componentRef: ComponentReference = Object.fromEntries(
    Object.entries(task.componentRef).filter(([key]) =>
      ["name", "digest", "tag", "url", "spec", "text"].includes(key),
    ),
  );
  const spec = componentRef.spec;
  if (!spec) return { ...task, componentRef };

  // Input values are editor state; configured values belong to the task.
  const values = Object.fromEntries(
    (spec.inputs ?? [])
      .filter((input) => input.value !== undefined)
      .map((input) => [input.name, input.value!]),
  );
  const args = { ...values, ...task.arguments };
  return {
    ...task,
    ...(Object.keys(args).length > 0 || task.arguments !== undefined
      ? { arguments: args }
      : {}),
    componentRef: {
      ...componentRef,
      spec: {
        ...spec,
        ...(spec.inputs && {
          inputs: spec.inputs.map(({ value: _value, ...input }) => input),
        }),
        ...(isGraphImplementation(spec.implementation) && {
          implementation: {
            ...spec.implementation,
            graph: {
              ...spec.implementation.graph,
              tasks: Object.fromEntries(
                Object.entries(spec.implementation.graph.tasks).map(
                  ([id, child]) => [id, normalizeTask(child)],
                ),
              ),
            },
          },
        }),
      },
    },
  };
}

export function remotePipelineTaskFromSpec(
  spec: ComponentSpec,
  previous?: TaskSpec,
): EmbeddedTask {
  const args = { ...previous?.arguments };
  for (const input of spec.inputs ?? []) {
    if (input.value !== undefined) args[input.name] = input.value;
    // A string argument was exposed as an editable input value on read.
    else if (typeof args[input.name] === "string") delete args[input.name];
  }
  return normalizeTask({
    ...previous,
    // Previous digest, URL, and text no longer identify the edited root spec.
    componentRef: { spec },
    ...(Object.keys(args).length > 0 || previous?.arguments !== undefined
      ? { arguments: args }
      : {}),
  }) as EmbeddedTask;
}

export function editorSpecFromRemoteTask(task: EmbeddedTask): ComponentSpec {
  const spec = task.componentRef.spec;
  return {
    ...spec,
    ...(spec.inputs && {
      inputs: spec.inputs.map((input) => {
        const argument = task.arguments?.[input.name];
        return typeof argument === "string"
          ? { ...input, value: argument }
          : input;
      }),
    }),
  };
}
