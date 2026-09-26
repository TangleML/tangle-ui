import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import type {
  Binding,
  ComponentReference,
  ComponentSpec,
  Input,
  Output,
  Task,
  TypeSpecType,
} from "@/models/componentSpec";
import { getFlexNodes } from "@/models/componentSpec/queries/flexNodes";
import { resolveEntityPositions } from "@/routes/v2/shared/nodes/buildUtils";
import { specNameIsProvisional } from "@/services/localPipelines/provisionalPipelineName";
import {
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
  RUN_NAME_TEMPLATE_ANNOTATION,
  TASK_COLOR_ANNOTATION,
} from "@/utils/annotationKeys";
import { isGraphImplementation } from "@/utils/componentSpec";

interface CanvasPosition {
  x: number;
  y: number;
}

type AiInputSpec = Pick<Input, "$id" | "name" | "type"> & {
  description?: string;
  default?: string;
  optional?: boolean;
  position?: CanvasPosition;
};

type AiOutputSpec = Pick<Output, "$id" | "name" | "type"> & {
  description?: string;
  position?: CanvasPosition;
};

interface AiComponentRef {
  name?: string;
  url?: string;
  spec?: {
    name?: string;
    inputs?: Array<{ name: string; type?: TypeSpecType }>;
    outputs?: Array<{ name: string; type?: TypeSpecType }>;
    implementation: "container" | "graph" | "missing";
  };
}

type AiTaskSpec = Pick<Task, "$id" | "name"> & {
  componentRef: AiComponentRef;
  arguments: Array<{ name: string; value?: unknown }>;
  isSubgraph?: boolean;
  position?: CanvasPosition;
  color?: string;
};

type AiBindingSpec = Pick<
  Binding,
  | "$id"
  | "sourceEntityId"
  | "sourcePortName"
  | "targetEntityId"
  | "targetPortName"
>;

interface AiStickyNoteSpec {
  id: string;
  title?: string;
  content?: string;
  color: string;
  borderColor?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  locked?: boolean;
  createdBy: string;
}

export interface AiSpec {
  name: string;
  nameIsProvisional?: boolean;
  description?: string;
  notes?: string;
  tags?: string[];
  runNameTemplate?: string;
  inputs: AiInputSpec[];
  outputs: AiOutputSpec[];
  tasks: AiTaskSpec[];
  bindings: AiBindingSpec[];
  stickyNotes?: AiStickyNoteSpec[];
  activeSubgraphPath?: string[];
  activeSubgraphTaskId?: string;
}

export interface SerializeSpecOptions {
  activeSubgraphPath?: string[];
  activeSubgraphTaskId?: string;
  activeSpec?: ComponentSpec;
}

function pickDefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

const serializeInput = (
  input: Input,
  position: CanvasPosition | undefined,
): AiInputSpec =>
  pickDefined({
    $id: input.$id,
    name: input.name,
    type: input.type,
    description: input.description || undefined,
    default: input.value || input.defaultValue || undefined,
    optional: input.optional,
    position,
  });

const serializeOutput = (
  output: Output,
  position: CanvasPosition | undefined,
): AiOutputSpec =>
  pickDefined({
    $id: output.$id,
    name: output.name,
    type: output.type,
    description: output.description || undefined,
    position,
  });

const serializeArgument = (arg: {
  name: string;
  value?: unknown;
}): { name: string; value?: unknown } =>
  pickDefined({ name: arg.name, value: arg.value });

const serializeTask = (
  task: Task,
  position: CanvasPosition | undefined,
): AiTaskSpec => {
  const color = task.annotations.get(TASK_COLOR_ANNOTATION);
  return pickDefined({
    $id: task.$id,
    name: task.name,
    componentRef: serializeComponentRef(task.resolvedComponentRef),
    arguments: task.arguments.map(serializeArgument),
    isSubgraph: isGraphImplementation(
      task.resolvedComponentRef.spec?.implementation,
    )
      ? true
      : undefined,
    position,
    color: color === "transparent" ? undefined : color,
  });
};

const serializeStickyNote = (note: FlexNodeData): AiStickyNoteSpec =>
  pickDefined({
    id: note.id,
    title: note.properties.title || undefined,
    content: note.properties.content || undefined,
    color: note.properties.color,
    borderColor: note.properties.borderColor,
    position: { x: note.position.x, y: note.position.y },
    size: { width: note.size.width, height: note.size.height },
    locked: note.locked,
    createdBy: note.metadata.createdBy,
  });

const serializeBinding = (binding: Binding): AiBindingSpec => ({
  $id: binding.$id,
  sourceEntityId: binding.sourceEntityId,
  sourcePortName: binding.sourcePortName,
  targetEntityId: binding.targetEntityId,
  targetPortName: binding.targetPortName,
});

const serializePort = (port: {
  name: string;
  type?: TypeSpecType;
}): { name: string; type?: TypeSpecType } =>
  pickDefined({ name: port.name, type: port.type });

/**
 * The implementation is reported by kind, not in full: a container spec is
 * long and a graph is the whole subgraph again, but a reader that cannot see
 * whether a task runs at all has no way to tell a component it just authored
 * from one that never landed.
 */
function implementationKind(
  spec: NonNullable<ComponentReference["spec"]>,
): "container" | "graph" | "missing" {
  if (isGraphImplementation(spec.implementation)) return "graph";
  return spec.implementation ? "container" : "missing";
}

function serializeComponentRef(ref: ComponentReference): AiComponentRef {
  return pickDefined({
    name: ref.name,
    url: ref.url,
    spec: ref.spec
      ? {
          ...pickDefined({
            name: ref.spec.name,
            inputs: ref.spec.inputs?.map(serializePort),
            outputs: ref.spec.outputs?.map(serializePort),
          }),
          implementation: implementationKind(ref.spec),
        }
      : undefined,
  });
}

/**
 * This crosses a Comlink `postMessage`, and any MobX observable left in it
 * throws `DataCloneError` and kills the whole call. `toJS` does not help: the
 * returned object is plain, and MobX only recurses into observable containers.
 */
const toPlainJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Narrower than the wire format: empty optional properties are dropped so the
 * blob stays small, and `activeSubgraphPath` says where the user is looking —
 * not where an edit lands, since an edit follows the `$id` it names.
 *
 * `activeSubgraphTaskId` accompanies it because that path is display names,
 * which are unique only within one graph, so the model cannot turn a name in it
 * back into the `$id` that `inSubgraphTaskId` needs.
 */
export function serializeSpecForAi(
  spec: ComponentSpec,
  {
    activeSubgraphPath = [],
    activeSubgraphTaskId,
    activeSpec = spec,
  }: SerializeSpecOptions = {},
): AiSpec {
  const insideSubgraph = activeSubgraphPath.length > 0;
  const stickyNotes = getFlexNodes(spec).map(serializeStickyNote);
  const positions = resolveEntityPositions(spec);
  const tags = activeSpec.annotations.get(PIPELINE_TAGS_ANNOTATION);
  return toPlainJson(
    pickDefined({
      name: spec.name,
      nameIsProvisional: specNameIsProvisional(spec) || undefined,
      description: spec.description || undefined,
      notes: activeSpec.annotations.get(PIPELINE_NOTES_ANNOTATION) || undefined,
      tags: tags.length > 0 ? tags : undefined,
      runNameTemplate:
        activeSpec.annotations.get(RUN_NAME_TEMPLATE_ANNOTATION) || undefined,
      inputs: spec.inputs.map((input) =>
        serializeInput(input, positions.get(input.$id)),
      ),
      outputs: spec.outputs.map((output) =>
        serializeOutput(output, positions.get(output.$id)),
      ),
      tasks: spec.tasks.map((task) =>
        serializeTask(task, positions.get(task.$id)),
      ),
      bindings: spec.bindings.map(serializeBinding),
      stickyNotes: stickyNotes.length > 0 ? stickyNotes : undefined,
      activeSubgraphPath: insideSubgraph ? activeSubgraphPath : undefined,
      activeSubgraphTaskId: insideSubgraph ? activeSubgraphTaskId : undefined,
    }),
  );
}
