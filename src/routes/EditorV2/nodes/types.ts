import type {
  Edge,
  EdgeProps,
  Node,
  NodeProps,
  XYPosition,
} from "@xyflow/react";
import type { ComponentType } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { IdGenerator } from "@/models/componentSpec/factories/idGenerator";

import type { SelectedNode } from "../store/editorStore";

// ---------------------------------------------------------------------------
// Clone handler types (re-exported for use in manifests)
// ---------------------------------------------------------------------------

export type { BindingSnapshot, NodeSnapshot } from "../store/nodeCloneHandlers";

export interface NodeCloneHandler {
  snapshot(spec: ComponentSpec, entityId: string): NodeSnapshot | null;
  clone(
    spec: ComponentSpec,
    snapshot: NodeSnapshot,
    idGen: IdGenerator,
    position: XYPosition,
  ): string | null;
}

// Re-import after the export so TS resolves the type locally
import type { NodeSnapshot } from "../store/nodeCloneHandlers";

// ---------------------------------------------------------------------------
// Node data types used by manifests and components
// ---------------------------------------------------------------------------

export interface TaskNodeData extends Record<string, unknown> {
  entityId: string;
  name: string;
}

export interface IONodeData extends Record<string, unknown> {
  entityId: string;
  ioType: "input" | "output";
  name: string;
}

// ---------------------------------------------------------------------------
// NodeTypeManifest – the contract every node-type plugin implements
// ---------------------------------------------------------------------------

export interface NodeTypeManifest {
  /** React Flow node type key (e.g. "task", "io", "conduit", "ghost"). */
  readonly type: string;

  /** Node ID prefix used to identify this type from an id string. */
  readonly idPrefix: string;

  /**
   * Domain entity type (e.g. "task", "input", "output", "conduit").
   * Multiple manifests may share the same RF `type` but differ here
   * (input & output both use RF type "io").
   */
  readonly entityType: string;

  // -- Rendering --------------------------------------------------------

  readonly component: ComponentType<NodeProps<any>>;
  readonly edgeTypes?: Record<string, ComponentType<EdgeProps<any>>>;

  // -- Spec → React Flow ------------------------------------------------

  buildNodes(spec: ComponentSpec): Node[];
  buildEdges?(spec: ComponentSpec): Edge[];

  /** Return strings that uniquely describe this manifest's entities for caching. */
  fingerprintParts?(spec: ComponentSpec): string[];

  /**
   * Transform the base binding edges (e.g. replace "default" edges with
   * a specialised edge type). Called after `buildBindingEdges`.
   */
  transformEdges?(spec: ComponentSpec, edges: Edge[]): Edge[];

  // -- Canvas operations ------------------------------------------------

  readonly drop?: {
    /** Key in the `application/reactflow` JSON payload. */
    readonly dataKey: string;
    handler(
      spec: ComponentSpec,
      data: unknown,
      position: XYPosition,
    ): void | Promise<void>;
  };

  updatePosition(
    spec: ComponentSpec,
    nodeId: string,
    position: XYPosition,
  ): void;

  deleteNode(spec: ComponentSpec, nodeId: string): void;

  findEntity?(spec: ComponentSpec, entityId: string): unknown | undefined;

  // -- Selection --------------------------------------------------------

  readonly selectable: boolean;
  toSelectedNode?(node: Node): SelectedNode | null;
  readonly contextPanelComponent?: ComponentType<{ entityId: string }>;

  // -- Display metadata (multi-selection, etc.) -------------------------

  displayName?(spec: ComponentSpec, entityId: string): string;
  readonly icon?: string;
  readonly iconColor?: string;

  // -- Interactions -----------------------------------------------------

  onDoubleClick?(spec: ComponentSpec, node: Node): void;

  // -- Clone / copy-paste -----------------------------------------------

  readonly cloneHandler?: NodeCloneHandler;
}
