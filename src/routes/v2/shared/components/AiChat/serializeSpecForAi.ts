/**
 * Serializes the live MobX `ComponentSpec` into a stable plain-JSON shape
 * the in-browser agent's CSOM tools can reason about.
 *
 * The shape is intentionally narrower than the wire format: optional
 * properties are omitted when empty (so the LLM sees a smaller blob),
 * subgraph tasks are flagged with `isSubgraph: true`, and the active
 * subgraph breadcrumb (`activeSubgraphPath`) is surfaced so the model
 * can disambiguate "fix the pipeline" vs "fix this subgraph" without a
 * separate bridge call. Edits land in whichever spec owns the `$id` they
 * name, so the breadcrumb tells the model where the user is looking
 * rather than where an edit will go.
 *
 * `activeSubgraphTaskId` accompanies it because the breadcrumb is made of
 * display names, which are unique only within one graph — the model cannot
 * turn a name in it back into the `$id` that `inSubgraphTaskId` needs.
 *
 * Flex nodes are serialized as `stickyNotes` — the term the product shows the
 * user everywhere — because the model quotes these names back to them.
 */
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
import { isGraphImplementation } from "@/utils/componentSpec";

type AiInputSpec = Pick<Input, "$id" | "name" | "type"> & {
  description?: string;
  default?: string;
  optional?: boolean;
};

type AiOutputSpec = Pick<Output, "$id" | "name" | "type"> & {
  description?: string;
};

interface AiComponentRef {
  name?: string;
  url?: string;
  spec?: {
    name?: string;
    inputs?: Array<{ name: string; type?: TypeSpecType }>;
    outputs?: Array<{ name: string; type?: TypeSpecType }>;
  };
}

type AiTaskSpec = Pick<Task, "$id" | "name"> & {
  componentRef: AiComponentRef;
  arguments: Array<{ name: string; value?: unknown }>;
  isSubgraph?: boolean;
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
  description?: string;
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
}

function pickDefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

const serializeInput = (input: Input): AiInputSpec =>
  pickDefined({
    $id: input.$id,
    name: input.name,
    type: input.type,
    description: input.description || undefined,
    default: input.defaultValue || undefined,
    optional: input.optional,
  });

const serializeOutput = (output: Output): AiOutputSpec =>
  pickDefined({
    $id: output.$id,
    name: output.name,
    type: output.type,
    description: output.description || undefined,
  });

const serializeArgument = (arg: {
  name: string;
  value?: unknown;
}): { name: string; value?: unknown } =>
  pickDefined({ name: arg.name, value: arg.value });

const serializeTask = (task: Task): AiTaskSpec =>
  pickDefined({
    $id: task.$id,
    name: task.name,
    componentRef: serializeComponentRef(task.resolvedComponentRef),
    arguments: task.arguments.map(serializeArgument),
    isSubgraph: isGraphImplementation(
      task.resolvedComponentRef.spec?.implementation,
    )
      ? true
      : undefined,
  });

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

function serializeComponentRef(ref: ComponentReference): AiComponentRef {
  return pickDefined({
    name: ref.name,
    url: ref.url,
    spec: ref.spec
      ? pickDefined({
          name: ref.spec.name,
          inputs: ref.spec.inputs?.map(serializePort),
          outputs: ref.spec.outputs?.map(serializePort),
        })
      : undefined,
  });
}

/**
 * The bridge hands this result to the agent worker over Comlink, so every value
 * in it has to survive `postMessage`'s structured clone. Anything read straight
 * off a keystone model is a MobX observable and throws `DataCloneError` there,
 * killing the whole `get_pipeline_state` call — and the fields that can carry
 * one are not obvious: a `dynamicData` argument value, a structured
 * `TypeSpecType`, a string array out of an annotation codec. `toJS` does not
 * help, because the object being returned is a plain one and MobX only
 * recurses into observable containers. A round-trip is lossless for this
 * shape: `AiSpec` is declared plain JSON and `pickDefined` has already
 * dropped every `undefined`.
 */
const toPlainJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function serializeSpecForAi(
  spec: ComponentSpec,
  { activeSubgraphPath = [], activeSubgraphTaskId }: SerializeSpecOptions = {},
): AiSpec {
  const insideSubgraph = activeSubgraphPath.length > 0;
  const stickyNotes = getFlexNodes(spec).map(serializeStickyNote);
  return toPlainJson(
    pickDefined({
      name: spec.name,
      description: spec.description || undefined,
      inputs: spec.inputs.map(serializeInput),
      outputs: spec.outputs.map(serializeOutput),
      tasks: spec.tasks.map(serializeTask),
      bindings: spec.bindings.map(serializeBinding),
      stickyNotes: stickyNotes.length > 0 ? stickyNotes : undefined,
      activeSubgraphPath: insideSubgraph ? activeSubgraphPath : undefined,
      activeSubgraphTaskId: insideSubgraph ? activeSubgraphTaskId : undefined,
    }),
  );
}
