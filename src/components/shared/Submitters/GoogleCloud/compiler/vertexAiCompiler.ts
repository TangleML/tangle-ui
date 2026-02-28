import {
  type ArgumentType,
  type ComponentSpec,
  type InputSpec,
  isContainerImplementation,
  isGraphImplementation,
  isSecretArgument,
  type StringOrPlaceholder,
  type TypeSpecType,
} from "@/utils/componentSpec";

import * as vertex from "./vertexPipelineSpec";

// # How to handle I/O:
// Rules (might have exceptions)
// output = output artifact
// inputValue => input parameter
// inputPath => input artifact
// # Fixing conflicts:
// 1) Artifact (may only come from task output) is consumed as value.
//   Solution 1) (implemented): Change input from parameter to artifact and use the input.artifact.value placeholder.
//      Cons: The downstream component input definitions depend on arguments. (Some inputs are changed from parameter to artifact.)
//   Solution 2): Add parameter output (with the same name as the artifact output) to the upstream component. The paths should be the same, so a single file will be treated as both parameter and output.
//      Cons: The upstream component output definitions depend on downstream consumption style. (Although parameter outputs are added, not changed.)
//   Solution 3): Insert a "Downloader" task between upstream and downstream.
//      Cons: Extra container task
// 2) Parameter (pipeline input or constant value) is consumed as artifact (as file).
//   Solution 1): Insert a "Uploader" task to convert parameter to artifact.
//      Cons: Extra container task

const sanitizePipelineInfoName = (pipelineContextName: string) => {
  return pipelineContextName.toLowerCase().replace(/\W/, "-");
};

type ResolvedCommandLineAndArgs = {
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  inputsConsumedAsParameter: Set<string>;
  inputsConsumedAsArtifact: Set<string>;
};

const resolveCommandLine = (
  componentSpec: ComponentSpec,
  taskArguments: Record<string, ArgumentType>,
  inputsThatHaveParameterArguments: Set<string>,
): ResolvedCommandLineAndArgs => {
  if (!isContainerImplementation(componentSpec.implementation)) {
    throw Error("resolveCommandLine only supports container components");
  }
  const containerSpec = componentSpec.implementation.container;

  const inputsConsumedAsParameter = new Set<string>();
  const inputsConsumedAsArtifact = new Set<string>();
  const convertArg = (arg: StringOrPlaceholder): string[] => {
    if (typeof arg == "string") {
      return [arg];
    } else if ("inputValue" in arg) {
      const inputName = arg.inputValue;
      if (!inputsThatHaveParameterArguments.has(inputName)) {
        // ! Important details:
        // In this branch, the argument comes from task output (or graph input with artifact argument).
        // All outputs are artifacts by default, so this argument is an artifact argument.
        // We can either try to change the argument to parameter or make the input to be an artifact to solve the conflict.
        // I choose to make the input to be artifact.
        // Adding input name to inputsConsumedAsPath to make the input rendered as an artifact input.
        inputsConsumedAsArtifact.add(inputName);
        return [`{{$.inputs.artifacts['${inputName}'].value}}`];
      } else {
        inputsConsumedAsParameter.add(inputName);
        return [`{{$.inputs.parameters['${inputName}']}}`];
      }
    } else if ("inputPath" in arg) {
      const inputName = arg.inputPath;
      inputsConsumedAsArtifact.add(inputName);
      return [`{{$.inputs.artifacts['${inputName}'].path}}`];
    } else if ("outputPath" in arg) {
      const outputName = arg.outputPath;
      return [`{{$.outputs.artifacts['${outputName}'].path}}`];
    } else if ("if" in arg) {
      const [ifCond, ifThen, ifElse] = [arg.if.cond, arg.if.then, arg.if.else];
      // TODO: Check false values, not just check for true
      let condEvaluatesToTrue = false;
      if (typeof ifCond === "string") {
        condEvaluatesToTrue = ifCond.toLowerCase() === "true";
      } else if (typeof ifCond === "boolean") {
        condEvaluatesToTrue = ifCond;
      } else if ("isPresent" in ifCond) {
        const inputName = ifCond.isPresent;
        condEvaluatesToTrue = inputName in taskArguments;
      } else if ("inputValue" in ifCond) {
        const inputName = ifCond.inputValue;
        if (!(inputName in taskArguments)) {
          condEvaluatesToTrue = false;
        } else {
          const taskArgument = taskArguments[inputName];
          if (typeof taskArgument === "string") {
            condEvaluatesToTrue = taskArgument.toLowerCase() === "true";
          } else {
            throw Error(
              "Using runtime conditions in component command line placeholders is not supported yet.",
            );
          }
        }
      } else {
        throw Error("Unexpected condition kind: " + ifCond);
      }
      const unresolvedArgs = condEvaluatesToTrue ? ifThen : ifElse;
      if (unresolvedArgs === undefined) {
        return [];
      }
      return unresolvedArgs.flatMap(convertArg);
    } else if ("concat" in arg) {
      const concatArgs = arg.concat;
      return [concatArgs.flatMap(convertArg).join("")];
    } else {
      throw Error(`Unknown kind of command-line argument: ${arg}`);
    }
  };

  const envValues =
    containerSpec.env &&
    Object.fromEntries(
      Object.entries(containerSpec.env).map(([key, value]) => {
        const resolvedArgArray = convertArg(value);
        if (resolvedArgArray.length !== 1) {
          throw Error(
            `Environment variable value must resolve to a single value, but got ${resolvedArgArray}`,
          );
        }
        const resolvedValue = resolvedArgArray[0];
        return [key, resolvedValue];
      }),
    );

  const result: ResolvedCommandLineAndArgs = {
    command: containerSpec.command?.flatMap(convertArg),
    args: containerSpec.args?.flatMap(convertArg),
    env: envValues,
    inputsConsumedAsParameter: inputsConsumedAsParameter,
    inputsConsumedAsArtifact: inputsConsumedAsArtifact,
  };
  return result;
};

const typeSpecToVertexPrimitiveTypeEnum = (
  typeSpec: TypeSpecType | undefined,
): vertex.PrimitiveTypeEnum => {
  if (typeof typeSpec === "string") {
    if (["integer"].includes(typeSpec.toLowerCase())) {
      return vertex.PrimitiveTypeEnum.INT;
    }
    if (["float", "double"].includes(typeSpec.toLowerCase())) {
      return vertex.PrimitiveTypeEnum.DOUBLE;
    }
  }
  return vertex.PrimitiveTypeEnum.STRING;
};

const typeSpecToVertexParameterSpec = (
  typeSpec: TypeSpecType | undefined,
): vertex.InputParameterSpec => {
  return {
    type: typeSpecToVertexPrimitiveTypeEnum(typeSpec),
  };
};

const typeSpecToVertexArtifactTypeSchema = (
  _typeSpec: TypeSpecType | undefined,
): vertex.ArtifactTypeSchema => {
  // TODO: Implement better mapping
  const artifactTypeSchema = {
    schemaTitle: "system.Artifact",
  };
  return artifactTypeSchema;
};

const typeSpecToVertexArtifactSpec = (
  typeSpec: TypeSpecType | undefined,
): vertex.InputArtifactSpec => {
  return {
    artifactType: typeSpecToVertexArtifactTypeSchema(typeSpec),
  };
};
// const typeSpecToVertexArtifactType(typeSpec: TypeSpecType) => {
//     return typeof typeSpec === "string" && ["String", "Integer", "Float", "Double", "Boolean", ]
// }

const stringToMlmdValue = (
  constantString: string,
  primitiveType: vertex.PrimitiveTypeEnum,
): vertex.MlmdValue => {
  switch (primitiveType) {
    case vertex.PrimitiveTypeEnum.STRING:
      return {
        stringValue: constantString,
      };
    case vertex.PrimitiveTypeEnum.INT:
      return {
        intValue: parseInt(constantString),
      };
    case vertex.PrimitiveTypeEnum.DOUBLE:
      return {
        doubleValue: parseFloat(constantString),
      };
    default:
      throw Error(`Unknown primitive type ${primitiveType}`);
  }
};

const MAKE_ARTIFACT_COMPONENT_ID = "_make_artifact";
const MAKE_ARTIFACT_EXECUTOR_ID = "_make_artifact";
const MAKE_ARTIFACT_INPUT_NAME = "parameter";
const MAKE_ARTIFACT_OUTPUT_NAME = "artifact";

const buildMakeArtifactTaskSpec = (
  parameterArgumentSpec: vertex.ParameterArgumentSpec,
): vertex.PipelineTaskSpec => {
  const taskSpec: vertex.PipelineTaskSpec = {
    componentRef: {
      name: MAKE_ARTIFACT_COMPONENT_ID,
    },
    taskInfo: {
      name: "Make artifact",
    },
    inputs: {
      parameters: {
        [MAKE_ARTIFACT_INPUT_NAME]: parameterArgumentSpec,
      },
    },
    cachingOptions: {
      enableCache: true,
    },
  };
  return taskSpec;
};

const makeArtifactComponentSpec: vertex.ComponentSpec = {
  executorLabel: MAKE_ARTIFACT_EXECUTOR_ID,
  inputDefinitions: {
    parameters: {
      [MAKE_ARTIFACT_INPUT_NAME]: {
        type: vertex.PrimitiveTypeEnum.STRING,
      },
    },
  },
  outputDefinitions: {
    artifacts: {
      [MAKE_ARTIFACT_OUTPUT_NAME]: {
        artifactType: {
          schemaTitle: "system.Artifact",
        },
      },
    },
  },
};

const makeArtifactExecutorSpec: vertex.ExecutorSpec = {
  container: {
    image: "alpine",
    command: [
      "sh",
      "-ec",
      'mkdir -p "$(dirname "$1")"; printf "%s" "$0" > "$1"',
      `{{$.inputs.parameters['${MAKE_ARTIFACT_INPUT_NAME}']}}`,
      `{{$.outputs.artifacts['${MAKE_ARTIFACT_OUTPUT_NAME}'].path}}`,
    ],
  },
};

function buildVertexParameterArgumentSpec(
  taskArgument: ArgumentType | undefined,
  inputSpec: InputSpec,
) {
  if (taskArgument === undefined) {
    if (inputSpec.default !== undefined) {
      taskArgument = inputSpec.default;
    } else {
      if (inputSpec.optional === true) {
        // TODO: Decide what the behavior should be
        // throw Error(`Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`);
        console.error(
          `Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`,
        );
        taskArgument = "";
      } else {
        throw Error(
          `Argument was not provided for required input "${inputSpec.name}"`,
        );
      }
    }
  }
  let result: vertex.ParameterArgumentSpec;
  if (typeof taskArgument === "string") {
    result = {
      runtimeValue: {
        constantValue: stringToMlmdValue(
          taskArgument,
          typeSpecToVertexPrimitiveTypeEnum(inputSpec.type),
        ),
      },
    };
    return result;
  } else if ("graphInput" in taskArgument) {
    result = {
      componentInputParameter: taskArgument.graphInput.inputName,
    };
    return result;
  } else if ("taskOutput" in taskArgument) {
    result = {
      taskOutputParameter: {
        producerTask: taskArgument.taskOutput.taskId,
        outputParameterKey: taskArgument.taskOutput.outputName,
      },
    };
    return result;
  } else if (isSecretArgument(taskArgument)) {
    throw Error(
      `Secret arguments are not supported in Vertex AI compilation. Input "${inputSpec.name}" uses secret "${taskArgument.secret.name}"`,
    );
  } else {
    throw Error(`Unknown kind of task argument: "${taskArgument}"`);
  }
}

function buildVertexArtifactArgumentSpec(
  taskArgument: ArgumentType | undefined,
  inputSpec: InputSpec,
  upstreamCannotBeArtifact: boolean,
  addMakeArtifactTaskAndGetArtifactArgumentSpec: (
    parameterArgumentSpec: vertex.ParameterArgumentSpec,
    namePrefix?: string,
  ) => vertex.ArtifactArgumentSpec,
) {
  //if (! (inputName in taskArguments)) {
  if (taskArgument === undefined) {
    // Checking for default value
    if (inputSpec.default !== undefined) {
      taskArgument = inputSpec.default;
    } else {
      if (inputSpec.optional === true) {
        // TODO: Decide what the behavior should be
        // throw Error(`Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`);
        console.error(
          `Input "${inputSpec.name}" is optional, but command-line still uses it when when it's not present.`,
        );
        taskArgument = "";
      } else {
        throw Error(
          `Argument was not provided for required input "${inputSpec.name}"`,
        );
      }
    }
  }
  let result: vertex.ArtifactArgumentSpec;
  if (typeof taskArgument === "string") {
    const parameterArgumentSpec: vertex.ParameterArgumentSpec = {
      runtimeValue: {
        constantValue: {
          // TODO: Check whether string is always OK here
          stringValue: taskArgument,
        },
      },
    };
    // TODO: Maybe use the taskArgument as part of the name?
    const convertedArtifactArgumentSpec =
      addMakeArtifactTaskAndGetArtifactArgumentSpec(
        parameterArgumentSpec,
        "Make artifact",
      );
    result = convertedArtifactArgumentSpec;
    return result;
  } else if ("graphInput" in taskArgument) {
    // Workaround for root DAG where all inputs must be parameters
    if (upstreamCannotBeArtifact) {
      const parameterArgumentSpec: vertex.ParameterArgumentSpec = {
        componentInputParameter: taskArgument.graphInput.inputName,
      };
      // We only need one task for each pipeline input parameter
      const convertedArtifactArgumentSpec =
        addMakeArtifactTaskAndGetArtifactArgumentSpec(
          parameterArgumentSpec,
          "Make artifact for " + taskArgument.graphInput.inputName,
        );
      result = convertedArtifactArgumentSpec;
    } else {
      result = {
        componentInputArtifact: taskArgument.graphInput.inputName,
      };
    }
    return result;
  } else if ("taskOutput" in taskArgument) {
    result = {
      taskOutputArtifact: {
        producerTask: taskArgument.taskOutput.taskId,
        outputArtifactKey: taskArgument.taskOutput.outputName,
      },
    };
    return result;
  } else if (isSecretArgument(taskArgument)) {
    throw Error(
      `Secret arguments are not supported in Vertex AI compilation. Input "${inputSpec.name}" uses secret "${taskArgument.secret.name}"`,
    );
  } else {
    throw Error(`Unknown kind of task argument: "${taskArgument}"`);
  }
}

const assertDefined = <T>(obj: T | undefined) => {
  if (obj === undefined) {
    throw TypeError("Object is undefined");
  }
  return obj;
};

const transformRecordValues = <T1, T2>(
  record: Record<string, T1>,
  transform: (value: T1) => T2,
) =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, transform(value)]),
  );

function buildVertexComponentSpecFromContainerComponentSpec(
  componentSpec: ComponentSpec,
  taskArguments: Record<string, ArgumentType>,
  inputsThatHaveParameterArguments: Set<string>,
  addExecutorAndGetId: (
    executor: vertex.ExecutorSpec,
    namePrefix?: string | undefined,
  ) => string,
) {
  if (!isContainerImplementation(componentSpec.implementation)) {
    throw Error("Only container components are supported by this function");
  }

  const containerSpec = componentSpec.implementation.container;

  const resolvedCommandLine = resolveCommandLine(
    componentSpec,
    taskArguments,
    inputsThatHaveParameterArguments,
  );

  const vertexExecutorSpec: vertex.ExecutorSpec = {
    container: {
      image: containerSpec.image,
      command: resolvedCommandLine.command,
      args: resolvedCommandLine.args,
      env:
        resolvedCommandLine.env &&
        Object.entries(resolvedCommandLine.env).map(([name, value]) => ({
          name: name,
          value: value,
        })),
    },
  };

  const vertexExecutorId = addExecutorAndGetId(
    vertexExecutorSpec,
    componentSpec.name ?? "Component",
  );

  const inputMap = new Map(
    (componentSpec.inputs ?? []).map((inputSpec) => [
      inputSpec.name,
      inputSpec,
    ]),
  );

  const vertexComponentInputsSpec: vertex.ComponentInputsSpec = {
    parameters: Object.fromEntries(
      Array.from(resolvedCommandLine.inputsConsumedAsParameter.values()).map(
        (inputName) => [
          inputName,
          typeSpecToVertexParameterSpec(inputMap.get(inputName)?.type),
        ],
      ),
    ),
    artifacts: Object.fromEntries(
      Array.from(resolvedCommandLine.inputsConsumedAsArtifact.values()).map(
        (inputName) => [
          inputName,
          typeSpecToVertexArtifactSpec(inputMap.get(inputName)?.type),
        ],
      ),
    ),
  };

  const vertexComponentOutputsSpec: vertex.ComponentOutputsSpec = {
    parameters: {},
    artifacts: Object.fromEntries(
      (componentSpec.outputs ?? []).map((outputSpec) => [
        outputSpec.name,
        typeSpecToVertexArtifactSpec(outputSpec.type),
      ]),
    ),
  };

  const vertexComponentSpec: vertex.ComponentSpec = {
    inputDefinitions: vertexComponentInputsSpec,
    outputDefinitions: vertexComponentOutputsSpec,
    // dag
    executorLabel: vertexExecutorId,
  };
  return vertexComponentSpec;
}

function buildVertexComponentSpecFromGraphComponentSpec(
  componentSpec: ComponentSpec,
  _taskArguments: Record<string, ArgumentType>,
  inputsThatHaveParameterArguments: Set<string>,
  addExecutorAndGetId: (
    executor: vertex.ExecutorSpec,
    namePrefix?: string,
  ) => string,
  addComponentAndGetId: (
    component: vertex.ComponentSpec,
    namePrefix?: string,
  ) => string,
) {
  if (!isGraphImplementation(componentSpec.implementation)) {
    throw Error("Only graph components are supported by this function");
  }

  const graphSpec = componentSpec.implementation.graph;

  const inputsConsumedAsParameter = new Set<string>();
  const inputsConsumedAsArtifact = new Set<string>();

  const vertexTasks: Record<string, vertex.PipelineTaskSpec> = {};
  const taskStringToTaskId = new Map<string, string>();

  const addTaskAndGetId = (
    task: vertex.PipelineTaskSpec,
    namePrefix: string = "Task",
  ) => {
    const serializedSpec = JSON.stringify(task);
    const existingId = taskStringToTaskId.get(serializedSpec);
    if (existingId !== undefined) {
      return existingId;
    }
    const usedIds = new Set(Object.keys(vertexTasks));
    const id = makeNameUniqueByAddingIndex(namePrefix, usedIds);
    taskStringToTaskId.set(serializedSpec, id);
    vertexTasks[id] = task;
    return id;
  };

  const addMakeArtifactTaskAndGetArtifactArgumentSpec = (
    parameterArgumentSpec: vertex.ParameterArgumentSpec,
    namePrefix: string = "Make artifact",
  ) => {
    // These system names are expected to not conflict with user task names
    const makeArtifactExecutorId = addExecutorAndGetId(
      makeArtifactExecutorSpec,
      MAKE_ARTIFACT_EXECUTOR_ID,
    );
    const makeArtifactComponentSpecCopy = {
      ...makeArtifactComponentSpec,
      executorLabel: makeArtifactExecutorId,
    };
    const makeArtifactComponentsId = addComponentAndGetId(
      makeArtifactComponentSpecCopy,
      MAKE_ARTIFACT_COMPONENT_ID,
    );
    const makeArtifactTaskSpec = buildMakeArtifactTaskSpec(
      parameterArgumentSpec,
    );
    makeArtifactTaskSpec.componentRef.name = makeArtifactComponentsId;
    const taskId = addTaskAndGetId(makeArtifactTaskSpec, namePrefix);
    const artifactArgumentSpec: vertex.ArtifactArgumentSpec = {
      taskOutputArtifact: {
        producerTask: taskId,
        outputArtifactKey: MAKE_ARTIFACT_OUTPUT_NAME,
      },
    };
    return artifactArgumentSpec;
  };

  for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
    if (taskSpec.componentRef.spec === undefined) {
      throw Error(`Task "${taskId}" does not have taskSpec.componentRef.spec.`);
    }
    try {
      const vertexTaskSpec = buildVertexTaskSpecFromTaskSpec(
        taskSpec.componentRef.spec,
        taskSpec.arguments ?? {},
        inputsThatHaveParameterArguments,
        addExecutorAndGetId,
        addComponentAndGetId,
        addMakeArtifactTaskAndGetArtifactArgumentSpec,
      );
      if (taskId in vertexTasks) {
        throw Error(
          `Task ID "${taskId}" is not unique. This cannot happen (unless user task ID clashes with special task ID).`,
        );
      }
      vertexTasks[taskId] = vertexTaskSpec;

      for (const argument of Object.values(
        vertexTaskSpec.inputs?.parameters ?? {},
      )) {
        if (argument.componentInputParameter !== undefined) {
          inputsConsumedAsParameter.add(argument.componentInputParameter);
        }
      }
      for (const argument of Object.values(
        vertexTaskSpec.inputs?.artifacts ?? {},
      )) {
        if ("componentInputArtifact" in argument) {
          inputsConsumedAsArtifact.add(argument.componentInputArtifact);
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        err.message = `Error compiling task ${taskId}: ` + err.message;
      }
      throw err;
    }
  }

  // Sanity checks
  const inputNamesThatAreUsedBothAsParameterAndArtifact = Array.from(
    inputsConsumedAsParameter,
  ).filter((x) => inputsConsumedAsArtifact.has(x));
  if (inputNamesThatAreUsedBothAsParameterAndArtifact.length > 0) {
    throw Error(
      `Compiler error: When compiling component "${componentSpec.name}" some inputs are used both as parameter and artifact: "${inputNamesThatAreUsedBothAsParameterAndArtifact}". Please file a bug report.`,
    );
  }
  const inputNamesThatAreParametersButAreConsumedAsArtifacts = Array.from(
    inputsThatHaveParameterArguments,
  ).filter((x) => inputsConsumedAsArtifact.has(x));
  if (inputNamesThatAreParametersButAreConsumedAsArtifacts.length > 0) {
    throw Error(
      `Compiler error: When compiling component "${componentSpec.name}" some parameter arguments are consumed as artifact: "${inputNamesThatAreParametersButAreConsumedAsArtifacts}". Please file a bug report.`,
    );
  }

  const dagOutputArtifactSpecs = transformRecordValues(
    graphSpec.outputValues ?? {},
    (taskOutputArgument) => {
      const result: vertex.DagOutputArtifactSpec = {
        artifactSelectors: [
          {
            producerSubtask: taskOutputArgument.taskOutput.taskId,
            outputArtifactKey: taskOutputArgument.taskOutput.outputName,
          },
        ],
      };
      return result;
    },
  );

  const inputMap = new Map(
    (componentSpec.inputs ?? []).map((inputSpec) => [
      inputSpec.name,
      inputSpec,
    ]),
  );

  const vertexComponentInputsSpec: vertex.ComponentInputsSpec = {
    parameters: Object.fromEntries(
      Array.from(inputsConsumedAsParameter.values()).map((inputName) => [
        inputName,
        typeSpecToVertexParameterSpec(inputMap.get(inputName)?.type),
      ]),
    ),
    artifacts: Object.fromEntries(
      Array.from(inputsConsumedAsArtifact.values()).map((inputName) => [
        inputName,
        typeSpecToVertexArtifactSpec(inputMap.get(inputName)?.type),
      ]),
    ),
  };

  const vertexComponentOutputsSpec: vertex.ComponentOutputsSpec = {
    // parameters: {},
    artifacts: Object.fromEntries(
      (componentSpec.outputs ?? []).map((outputSpec) => [
        outputSpec.name,
        typeSpecToVertexArtifactSpec(outputSpec.type),
      ]),
    ),
  };

  const vertexComponentSpec: vertex.ComponentSpec = {
    inputDefinitions: vertexComponentInputsSpec,
    outputDefinitions: vertexComponentOutputsSpec,
    dag: {
      tasks: vertexTasks,
      outputs: {
        artifacts: dagOutputArtifactSpecs,
        // parameters: {},
      },
    },
  };
  return vertexComponentSpec;
}

function buildVertexComponentSpecFromComponentSpec(
  componentSpec: ComponentSpec,
  taskArguments: Record<string, ArgumentType>,
  inputsThatHaveParameterArguments: Set<string>,
  addExecutorAndGetId: (
    executor: vertex.ExecutorSpec,
    namePrefix?: string,
  ) => string,
  addComponentAndGetId: (
    component: vertex.ComponentSpec,
    namePrefix?: string,
  ) => string,
) {
  if (isContainerImplementation(componentSpec.implementation)) {
    return buildVertexComponentSpecFromContainerComponentSpec(
      componentSpec,
      taskArguments,
      inputsThatHaveParameterArguments,
      addExecutorAndGetId,
    );
  } else if (isGraphImplementation(componentSpec.implementation)) {
    return buildVertexComponentSpecFromGraphComponentSpec(
      componentSpec,
      taskArguments,
      inputsThatHaveParameterArguments,
      addExecutorAndGetId,
      addComponentAndGetId,
    );
  } else {
    throw Error(
      `Unsupported component implementation kind: ${componentSpec.implementation}`,
    );
  }
}

const buildVertexTaskSpecFromTaskSpec = (
  componentSpec: ComponentSpec,
  //passedArgumentNames: string[],
  taskArguments: Record<string, ArgumentType>,
  graphInputsWithParameterArguments: Set<string>,
  addExecutorAndGetId: (
    executor: vertex.ExecutorSpec,
    namePrefix?: string,
  ) => string,
  addComponentAndGetId: (
    component: vertex.ComponentSpec,
    namePrefix?: string,
  ) => string,
  addMakeArtifactTaskAndGetArtifactArgumentSpec: (
    parameterArgumentSpec: vertex.ParameterArgumentSpec,
    namePrefix?: string,
  ) => vertex.ArtifactArgumentSpec,
) => {
  // So-called "parameter" arguments can either be constant arguments
  // or come from the arguments to the graph component of the current task.
  // In the current implementation the parameter arguments cannot come from task outputs since all task outputs are artifacts.
  const inputsThatHaveParameterArguments = new Set(
    (componentSpec.inputs ?? [])
      .map((inputSpec) => inputSpec.name)
      .filter((inputName) => {
        const taskArgument = taskArguments[inputName];
        if (taskArgument === undefined) {
          // Missing arguments fall back to default values which are constant strings which are parameters.
          return true;
        }
        if (typeof taskArgument === "string") {
          return true;
        }
        return (
          "graphInput" in taskArgument &&
          graphInputsWithParameterArguments.has(
            taskArgument.graphInput.inputName,
          )
        );
      }),
  );

  const inputMap = new Map(
    (componentSpec.inputs ?? []).map((inputSpec) => [
      inputSpec.name,
      inputSpec,
    ]),
  );

  const vertexComponentSpec: vertex.ComponentSpec =
    buildVertexComponentSpecFromComponentSpec(
      componentSpec,
      taskArguments,
      inputsThatHaveParameterArguments,
      addExecutorAndGetId,
      addComponentAndGetId,
    );

  const vertexComponentId = addComponentAndGetId(
    vertexComponentSpec,
    componentSpec.name ?? "Component",
  );

  const vertexTaskParameterArguments = Object.fromEntries(
    Object.keys(vertexComponentSpec.inputDefinitions?.parameters ?? {}).map(
      (inputName) => [
        inputName,
        buildVertexParameterArgumentSpec(
          taskArguments[inputName],
          assertDefined(inputMap.get(inputName)),
        ),
      ],
    ),
  );

  const vertexTaskArtifactArguments = Object.fromEntries(
    Object.keys(vertexComponentSpec.inputDefinitions?.artifacts ?? {}).map(
      (inputName) => [
        inputName,
        buildVertexArtifactArgumentSpec(
          taskArguments[inputName],
          assertDefined(inputMap.get(inputName)),
          inputsThatHaveParameterArguments.has(inputName),
          addMakeArtifactTaskAndGetArtifactArgumentSpec,
        ),
      ],
    ),
  );

  const vertexTaskSpec: vertex.PipelineTaskSpec = {
    taskInfo: {
      // This is the task display name, not an ID
      name: componentSpec.name ?? "Component",
    },
    inputs: {
      parameters: vertexTaskParameterArguments,
      artifacts: vertexTaskArtifactArguments,
    },
    cachingOptions: {
      enableCache: true,
    },
    componentRef: {
      name: vertexComponentId,
    },
  };

  return vertexTaskSpec;
};

const makeNameUniqueByAddingIndex = (
  name: string,
  existingNames: Set<string>,
): string => {
  let finalName = name;
  let index = 1;
  while (existingNames.has(finalName)) {
    index++;
    finalName = name + " " + index.toString();
  }
  return finalName;
};

const buildVertexPipelineSpecFromGraphComponentSpec = (
  componentSpec: ComponentSpec,
  pipelineContextName = "pipeline",
) => {
  const vertexExecutors: Record<string, vertex.ExecutorSpec> = {};
  const executorStringToExecutorId = new Map<string, string>();
  const vertexComponents: Record<string, vertex.ComponentSpec> = {};
  const componentStringToComponentId = new Map<string, string>();

  const addExecutorAndGetId = (
    executor: vertex.ExecutorSpec,
    namePrefix: string = "Executor",
  ) => {
    const serializedSpec = JSON.stringify(executor);
    const existingId = executorStringToExecutorId.get(serializedSpec);
    if (existingId !== undefined) {
      return existingId;
    }
    const usedIds = new Set(Object.keys(vertexExecutors));
    const id = makeNameUniqueByAddingIndex(namePrefix, usedIds);
    executorStringToExecutorId.set(serializedSpec, id);
    vertexExecutors[id] = executor;
    return id;
  };

  const addComponentAndGetId = (
    component: vertex.ComponentSpec,
    namePrefix: string = "Component",
  ) => {
    const serializedSpec = JSON.stringify(component);
    const existingId = componentStringToComponentId.get(serializedSpec);
    if (existingId !== undefined) {
      return existingId;
    }
    const usedIds = new Set(Object.keys(vertexComponents));
    const id = makeNameUniqueByAddingIndex(namePrefix, usedIds);
    componentStringToComponentId.set(serializedSpec, id);
    vertexComponents[id] = component;
    return id;
  };

  // All root graph inputs are parameters
  const graphInputsWithParameterArguments = new Set(
    (componentSpec.inputs ?? []).map((inputSpec) => inputSpec.name),
  );

  const pipelineArguments: Record<string, ArgumentType> = Object.fromEntries(
    (componentSpec.inputs ?? []).map((inputSpec) => {
      const argument: ArgumentType = {
        graphInput: { inputName: inputSpec.name },
      };
      return [inputSpec.name, argument];
    }),
  );
  const pipelineComponentSpec = buildVertexComponentSpecFromComponentSpec(
    componentSpec,
    pipelineArguments,
    graphInputsWithParameterArguments,
    addExecutorAndGetId,
    addComponentAndGetId,
  );

  const vertexPipelineSpec: vertex.PipelineSpec = {
    pipelineInfo: {
      name: sanitizePipelineInfoName(pipelineContextName),
    },
    sdkVersion: "Cloud-Pipelines",
    schemaVersion: "2.0.0",
    deploymentSpec: {
      executors: vertexExecutors,
    },
    components: vertexComponents,
    root: pipelineComponentSpec,
  };
  return vertexPipelineSpec;
};

export const buildVertexPipelineJobFromGraphComponent = (
  componentSpec: ComponentSpec,
  gcsOutputDirectory: string,
  pipelineArguments?: Map<string, string>,
  pipelineContextName = "pipeline",
) => {
  // The pipelineContextName affects caching

  const pipelineSpec = buildVertexPipelineSpecFromGraphComponentSpec(
    componentSpec,
    pipelineContextName,
  );
  const inputParameterDefinitions =
    (pipelineSpec.root.inputDefinitions ?? {}).parameters ?? {};

  // Adding the default values
  pipelineArguments = pipelineArguments || new Map();
  const defaultInputValuePairs = (componentSpec.inputs ?? [])
    .filter((inputSpec) => inputSpec.default !== undefined)
    .map((inputSpec): [string, string] => [
      inputSpec.name,
      String(inputSpec.default),
    ]);
  const allPipelineArguments = new Map(
    defaultInputValuePairs.concat(Array.from(pipelineArguments.entries())),
  );

  // Converting the pipeline arguments
  const convertedPipelineArguments: Record<string, any> = {};
  for (const [key, value] of Array.from(allPipelineArguments.entries())) {
    if (!(key in inputParameterDefinitions)) {
      console.error(
        `A pipeline argument was provided for the input "${key}" that does not exist in the pipeline spec.`,
      );
      continue;
    }
    convertedPipelineArguments[key] = stringToMlmdValue(
      value,
      inputParameterDefinitions[key].type,
    );
  }

  const pipelineJob: vertex.PipelineJob = {
    // name: "<>",
    // Does not show up in the UX
    displayName: componentSpec.name ?? "Pipeline",
    // labels: {},
    runtimeConfig: {
      parameters: convertedPipelineArguments,
      gcsOutputDirectory: gcsOutputDirectory,
    },
    pipelineSpec: pipelineSpec,
    // encryptionSpec: {},
    // serviceAccount: "<>",
    // network: {},
  };
  return pipelineJob;
};
